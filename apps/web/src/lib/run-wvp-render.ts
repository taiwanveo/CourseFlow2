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

    if (await hasBuiltPresentation(payload.projectId)) {
      const localDist = presentationDistDir(payload.projectId);
      const { cp } = await import("node:fs/promises");
      await cp(localDist, distDir, { recursive: true });
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
    const { recordWvpPresentation } = await import("@courseflow/presentation/record");
    await recordWvpPresentation({
      distDir,
      outputPath: outLocal,
      onProgress: payload.onProgress,
    });

    const fileBuf = await readFile(outLocal);
    if (fileBuf.length < 4096) {
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
