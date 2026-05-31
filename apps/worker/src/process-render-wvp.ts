/**
 * Worker 端的 WVP MP4 錄製流程。
 *
 * Web inline 匯出與 Worker 背景匯出雖然最終都會呼叫同一個錄製器，
 * 但 Worker 版本有一個關鍵差異：它不能假設本機一定已有 dist，因為 Worker 容器通常是獨立機器。
 *
 * 因此這裡的核心責任是：
 * 1. 先從 Storage 取回 dist manifest 與所有靜態檔。
 * 2. 在暫存目錄重建可錄製的 dist。
 * 3. 呼叫 Playwright 錄製器輸出 MP4。
 * 4. 把 MP4 上傳回 Storage，交由 render job 對外提供。
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@courseflow/db";
import { downloadDistDirectory, wvpDistStoragePrefix } from "@courseflow/presentation";
import { recordWvpPresentation } from "@courseflow/presentation/record";

type Supabase = ReturnType<typeof createServiceClient>;

/**
 * 執行一次背景 WVP 錄製，並回傳最終 Storage 路徑。
 *
 * 這個函式只關心錄製本身，不負責更新 `render_jobs` 狀態；
 * job 狀態管理在上層 `processors.ts`，這樣可以把「任務生命週期」與「單次錄製執行」分層處理。
 */
export async function processRenderWvp(payload: {
  projectId: string;
  userId: string;
  renderJobId: string;
  onProgress?: (n: number) => Promise<void>;
}): Promise<string> {
  const supabase = createServiceClient() as Supabase;
  const workDir = join(tmpdir(), `cf-wvp-render-${randomUUID()}`);
  const distDir = join(workDir, "dist");
  await mkdir(distDir, { recursive: true });

  try {
    await payload.onProgress?.(12);
    const prefix = wvpDistStoragePrefix(payload.userId, payload.projectId);

    // manifest 讓 Worker 能精確知道應該還原哪些 dist 檔案，避免遺漏巢狀資源。
    let manifest: string[] | undefined;
    const { data: manifestBlob } = await supabase.storage
      .from("courseflow-assets")
      .download(`${prefix}/cf-dist-manifest.json`);
    if (manifestBlob) {
      manifest = JSON.parse(await manifestBlob.text()) as string[];
    }

    await downloadDistDirectory(
      async (path) => {
        const { data, error } = await supabase.storage.from("courseflow-assets").download(path);
        if (error || !data) return null;
        return Buffer.from(await data.arrayBuffer());
      },
      prefix,
      distDir,
      manifest,
    );

    await payload.onProgress?.(28);
    const outLocal = join(workDir, "output.mp4");

    await recordWvpPresentation({
      distDir,
      outputPath: outLocal,
      // 將底層錄製器的進度原樣回傳給 job 管理層，避免這裡重複定義進度規則。
      onProgress: async (pct: number) => payload.onProgress?.(pct),
    });

    const fileBuf = await readFile(outLocal);
    if (fileBuf.length < 4096) {
      throw new Error(`WVP 錄製輸出過小（${fileBuf.length} bytes）`);
    }

    await payload.onProgress?.(88);
    const storagePath = `${payload.userId}/${payload.projectId}/renders/${payload.renderJobId}.mp4`;
    const { error } = await supabase.storage.from("courseflow-assets").upload(storagePath, fileBuf, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (error) throw new Error(error.message);

    return storagePath;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
