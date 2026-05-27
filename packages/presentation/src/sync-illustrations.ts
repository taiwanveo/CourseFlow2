import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wvpStepImageFileName } from "./illustration-paths.js";

export interface PresentationIllustrationFile {
  wvpChapterId: string;
  /** WVP 步驟索引（0-based），檔名為 step+1 的兩位數 .jpg */
  stepIndex: number;
  buffer: Buffer;
}

/** 寫入 presentation/public/images/<chapterId>/01.jpg … */
export async function writePresentationIllustrationFiles(
  presentationDir: string,
  files: PresentationIllustrationFile[],
): Promise<number> {
  let written = 0;
  for (const f of files) {
    if (!f.buffer.length) continue;
    const dir = join(presentationDir, "public", "images", f.wvpChapterId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, wvpStepImageFileName(f.stepIndex)),
      f.buffer,
    );
    written++;
  }
  return written;
}
