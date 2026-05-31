/**
 * Web 行程內的 WVP MP4 匯出協調器。
 *
 * 這條路徑主要服務兩類場景：
 * 1. 本機開發沒有啟 Worker，但仍要直接匯出 MP4。
 * 2. 正式環境在特定條件下需要 inline fallback。
 *
 * 這個模組不自己 build WVP，也不自己維護 job queue；它的責任是：
 * - 準備一份可錄製的 dist
 * - 呼叫底層 Playwright 錄製器
 * - 把成品 MP4 上傳回 Storage
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  downloadWvpDistFromStorage,
  hasWvpDistInStorage,
  uploadWvpDistToStorage,
} from "@/lib/wvp-dist-storage";
import { hasBuiltPresentation, presentationDistDir } from "@/lib/wvp-workdir";

/**
 * 執行單次 WVP MP4 匯出。
 *
 * 流程重點：
 * 1. 優先使用本機已 build 的 dist，避免不必要的 Storage 往返。
 * 2. 若本機沒有 dist，就嘗試從 Storage 還原既有快取。
 * 3. 交給 `@courseflow/presentation/record` 進行實際錄製。
 * 4. 驗證輸出大小，避免把空檔或失敗檔誤判為成功。
 * 5. 上傳最終 MP4 到 Storage，供 render job / 前端下載。
 */
export async function runWvpMp4Export(payload: {
  projectId: string;
  userId: string;
  renderJobId: string;
  onProgress?: (n: number) => void;
}): Promise<{ storagePath: string; bytes: number }> {
  const supabase = createServiceClient();
  const workDir = join(tmpdir(), `cf-wvp-render-${randomUUID()}`);
  const distDir = join(workDir, "dist");
  await mkdir(distDir, { recursive: true });

  try {
    payload.onProgress?.(10);

    // 先吃本機 dist，可避免重複下載，也能讓本機開發的迭代速度最快。
    if (await hasBuiltPresentation(payload.projectId)) {
      const localDist = presentationDistDir(payload.projectId);
      const { cp } = await import("node:fs/promises");
      await cp(localDist, distDir, { recursive: true });
    // 若本機沒有 dist，才回退到 Storage 快取。
    } else if (await hasWvpDistInStorage(supabase, payload.userId, payload.projectId)) {
      await downloadWvpDistFromStorage(
        supabase,
        payload.userId,
        payload.projectId,
        distDir,
      );
    } else {
      throw new Error("請先在「3. 語音生成」完成 TTS，並在「4. 預覽匯出」打包課程預覽後再匯出 MP4");
    }

    payload.onProgress?.(25);
    const outLocal = join(workDir, "output.mp4");
    // 錄製器刻意走子路徑 import，避免把 Playwright 重型依賴帶進主入口打包面。
    const { recordWvpPresentation } = await import("@courseflow/presentation/record");
    await recordWvpPresentation({
      distDir,
      outputPath: outLocal,
      onProgress: payload.onProgress,
    });

    const fileBuf = await readFile(outLocal);
    if (fileBuf.length < 4096) {
      // 4KB 不是影片品質門檻，而是實務上的失敗保護線，避免空檔被當成成功輸出。
      throw new Error(`錄製輸出過小（${fileBuf.length} bytes）`);
    }

    payload.onProgress?.(90);
    const storagePath = `${payload.userId}/${payload.projectId}/renders/${payload.renderJobId}.mp4`;
    const { error } = await supabase.storage.from("courseflow-assets").upload(storagePath, fileBuf, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (error) throw new Error(error.message);

    return { storagePath, bytes: fileBuf.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
