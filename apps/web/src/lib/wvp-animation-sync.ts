import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** 寫入 presentation/public/animations/<chapterId>/01.html */
export async function writePresentationAnimationFile(
  presentationDir: string,
  wvpChapterId: string,
  stepIndex: number,
  html: string,
): Promise<void> {
  const dir = join(presentationDir, "public", "animations", wvpChapterId);
  await mkdir(dir, { recursive: true });
  const fileName = `${String(stepIndex + 1).padStart(2, "0")}.html`;
  await writeFile(join(dir, fileName), html, "utf-8");
}

/** 取得 presentation 中 animation 的相對 URL（給 chapter TSX 用） */
export function stepAnimationRelPath(wvpChapterId: string, stepIndex: number): string {
  const fileName = `${String(stepIndex + 1).padStart(2, "0")}.html`;
  return `animations/${wvpChapterId}/${fileName}`;
}
