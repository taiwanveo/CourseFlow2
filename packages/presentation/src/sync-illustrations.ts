import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  detectStepImageExtFromBuffer,
  isValidImageBuffer,
  normalizeStepImageExt,
  wvpStepImageFileName,
  type WvpStepImageExt,
} from "./step-image-media.js";

export interface PresentationIllustrationFile {
  wvpChapterId: string;
  /** WVP 步驟索引（0-based），檔名為 step+1 的兩位數 + 副檔名 */
  stepIndex: number;
  buffer: Buffer;
  ext?: WvpStepImageExt;
}

/** 寫入 presentation/public/images/<chapterId>/01.jpg … */
export async function writePresentationIllustrationFiles(
  presentationDir: string,
  files: PresentationIllustrationFile[],
): Promise<number> {
  let written = 0;
  for (const f of files) {
    if (!f.buffer.length || !isValidImageBuffer(f.buffer)) continue;
    const dir = join(presentationDir, "public", "images", f.wvpChapterId);
    await mkdir(dir, { recursive: true });
    const ext =
      f.ext ??
      normalizeStepImageExt(detectStepImageExtFromBuffer(f.buffer));
    await writeFile(
      join(dir, wvpStepImageFileName(f.stepIndex, ext)),
      f.buffer,
    );
    written++;
  }
  return written;
}
