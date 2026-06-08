import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface PresentationAudioFile {
  wvpChapterId: string;
  stepIndex: number;
  buffer: Buffer;
}

/**
 * 將 TTS 檔寫入 presentation/public/audio/<chapterId>/<step>.mp3
 * （與 WVP App.tsx 路徑一致：1-based 檔名）
 */
export async function writePresentationAudioFiles(
  presentationDir: string,
  files: PresentationAudioFile[],
): Promise<number> {
  let written = 0;
  for (const f of files) {
    if (!f.buffer.length) continue;
    const dir = join(presentationDir, "public", "audio", f.wvpChapterId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${f.stepIndex + 1}.mp3`), f.buffer);
    written++;
  }
  if (written > 0) {
    const publicDir = join(presentationDir, "public");
    await mkdir(publicDir, { recursive: true });
    await writeFile(
      join(publicDir, "audio-revision.json"),
      JSON.stringify({ revision: new Date().toISOString() }),
      "utf8",
    );
  }
  return written;
}
