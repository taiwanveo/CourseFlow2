import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@courseflow/db";
import { recordWvpPresentation, downloadDistDirectory, wvpDistStoragePrefix } from "@courseflow/presentation";

type Supabase = ReturnType<typeof createServiceClient>;

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
      onProgress: async (pct) => payload.onProgress?.(pct),
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
