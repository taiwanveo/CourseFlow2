import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  chapterBindsNarrationText,
  chapterUsesInvalidMaskReveal,
  hasVisualDemoInSources,
} from "./visual-demo.js";

export interface WriteChapterSourcesInput {
  folderName: string;
  componentName: string;
  narrations: string[];
  chapterTsx: string;
  chapterCss: string;
}

/** 修正 LLM 常見錯誤：Chapter.css、函式名稱與檔名不一致 */
export function normalizeChapterTsx(tsx: string, componentName: string): string {
  let out = tsx.trim();

  out = out.replace(
    /import\s+["']\.\/Chapter\.css["']\s*;/g,
    `import "./${componentName}.css";`,
  );
  out = out.replace(
    /import\s+["']\.\/[^"']+\.css["']\s*;/g,
    `import "./${componentName}.css";`,
  );

  out = out.replace(
    /export\s+default\s+function\s+Chapter\s*\(/g,
    `export default function ${componentName}(`,
  );

  if (!out.includes(`import "./${componentName}.css"`)) {
    const maskImport = 'import { MaskReveal } from "../../components/MaskReveal";';
    if (out.includes(maskImport)) {
      out = out.replace(
        maskImport,
        `${maskImport}\nimport "./${componentName}.css";`,
      );
    } else if (out.includes("ChapterStepProps")) {
      out = out.replace(
        /(import type \{ ChapterStepProps \}[^\n]*\n)/,
        `$1import "./${componentName}.css";\n`,
      );
    }
  }

  return out;
}

export function validateChapterTsx(
  tsx: string,
  stepCount: number,
  componentName: string,
  chapterCss = "",
  narrations: string[] = [],
): boolean {
  const normalized = normalizeChapterTsx(tsx, componentName);
  if (!normalized.includes("export default function")) return false;
  if (!normalized.includes("ChapterStepProps")) return false;
  if (!normalized.includes("MaskReveal")) return false;
  if (!normalized.includes(`./${componentName}.css`)) return false;
  if (!normalized.includes(`function ${componentName}`)) return false;
  if (chapterUsesInvalidMaskReveal(normalized)) return false;
  if (!hasVisualDemoInSources(normalized, chapterCss)) return false;
  if (narrations.length > 0 && !chapterBindsNarrationText(normalized, narrations)) {
    return false;
  }
  for (let i = 0; i < stepCount; i++) {
    if (!normalized.includes(`step === ${i}`)) return false;
  }
  return normalized.length > 200;
}

export async function writeChapterSourcesRaw(
  presentationDir: string,
  input: WriteChapterSourcesInput,
): Promise<void> {
  const chapterDir = join(presentationDir, "src", "chapters", input.folderName);
  await mkdir(chapterDir, { recursive: true });

  const tsx = normalizeChapterTsx(input.chapterTsx, input.componentName);

  const narrationsTs = `import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
${input.narrations.map((n) => `  ${JSON.stringify(n)},`).join("\n")}
];
`;

  await writeFile(join(chapterDir, `${input.componentName}.tsx`), tsx, "utf8");
  await writeFile(join(chapterDir, `${input.componentName}.css`), input.chapterCss, "utf8");
  await writeFile(join(chapterDir, "narrations.ts"), narrationsTs, "utf8");
}

/** 建置前掃描並修正所有章節 TSX 的 CSS import */
export async function repairPresentationChapterImports(
  presentationDir: string,
): Promise<number> {
  const chaptersRoot = join(presentationDir, "src", "chapters");
  let fixed = 0;
  let folderNames: string[];
  try {
    folderNames = await readdir(chaptersRoot);
  } catch {
    return 0;
  }

  for (const name of folderNames) {
    const dir = join(chaptersRoot, name);
    const files = await readdir(dir);
    const tsxFile = files.find((f) => f.endsWith(".tsx"));
    if (!tsxFile) continue;
    const componentName = tsxFile.replace(/\.tsx$/, "");
    const path = join(dir, tsxFile);
    const raw = await readFile(path, "utf8");
    const normalized = normalizeChapterTsx(raw, componentName);
    if (normalized !== raw) {
      await writeFile(path, normalized, "utf8");
      fixed += 1;
    }
  }
  return fixed;
}
