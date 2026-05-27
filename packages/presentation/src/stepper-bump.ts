import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const STORAGE_KEY_LINE =
  /const\s+STORAGE_KEY\s*=\s*"(presentation-cursor-v\d+)"\s*;/;

/** 修復舊版 bump 誤寫成 const "presentation-cursor-vN"; 的檔案 */
function repairBrokenStorageKeyLine(src: string): string {
  return src.replace(
    /const\s+"(presentation-cursor-v\d+)"\s*;/,
    'const STORAGE_KEY = "$1";',
  );
}

/** 章節步數變更後 bump useStepper STORAGE_KEY，避免舊 cursor 錯位 */
export async function bumpPresentationStepperKey(presentationDir: string): Promise<void> {
  const path = join(presentationDir, "src", "hooks", "useStepper.ts");
  let src = await readFile(path, "utf8");
  src = repairBrokenStorageKeyLine(src);

  const m = src.match(STORAGE_KEY_LINE);
  if (!m?.[1]) return;

  const next = Number(m[1].replace("presentation-cursor-v", "")) + 1;
  src = src.replace(STORAGE_KEY_LINE, `const STORAGE_KEY = "presentation-cursor-v${next}";`);
  await writeFile(path, src, "utf8");
}
