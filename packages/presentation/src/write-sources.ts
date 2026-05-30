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

/**
 * 自動修復 LLM 常見的 JSX 語法錯誤，確保寫入磁碟的 TSX 可以通過 esbuild。
 *
 * 已知模式：
 *   url={{expr}}  →  url={expr}   （雙花括號屬性值；LLM 把物件語法誤套到非 style 屬性）
 */
export function sanitizeChapterTsx(tsx: string): string {
  // 修復：非 style 屬性的雙花括號 prop={{ expr }} → prop={ expr }
  // 匹配：word={{ 到對應的 }} — 用貪婪替換處理巢狀括號不完整的情況
  // 只修 style= 以外的屬性（style={{ }} 是合法的 React 物件語法）
  return tsx.replace(/\b(?!style=)(\w+=)\{\{([^}]*(?:\}[^}][^}]*)*)\}\}/g, "$1{$2}");
}

export function validateChapterTsx(
  tsx: string,
  stepCount: number,
  componentName: string,
  chapterCss = "",
  narrations: string[] = [],
  /** 圖靈 TypeScript compile-check，由呼叫端注入（可用 ts.transpileModule 實作） */
  syntaxChecker?: (code: string) => boolean,
): boolean {
  const normalized = normalizeChapterTsx(tsx, componentName);
  if (!normalized.includes("export default function")) return false;
  if (!normalized.includes("ChapterStepProps")) return false;
  if (!normalized.includes(`./${componentName}.css`)) return false;
  if (!normalized.includes(`function ${componentName}`)) return false;
  if (chapterUsesInvalidMaskReveal(normalized)) return false;
  if (!hasVisualDemoInSources(normalized, chapterCss)) return false;
  if (narrations.length > 0 && !chapterBindsNarrationText(normalized, narrations)) {
    return false;
  }
  // LLM 常犯：把整段 narration 口播句複製到 JSX 字串裡（如 title="..." body="..."）。
  // narration 句子超過 20 字且逐字出現在 TSX，視為錯誤——口播只屬於 narrations.ts。
  for (const narration of narrations) {
    if (narration.length > 20 && normalized.includes(narration)) return false;
  }
  for (let i = 0; i < stepCount; i++) {
    if (!normalized.includes(`step === ${i}`)) return false;
  }
  // 禁止多餘的步驟：step === stepCount 或更高代表 unreachable 分支，
  // 正確內容可能被放到永遠到達不了的 step 裡，導致畫面顯示錯誤
  if (normalized.includes(`step === ${stepCount}`)) return false;
  if (normalized.length <= 200) return false;
  // 快速捕捉 LLM 常犯的 JSX 屬性雙花括號語法錯誤，如 url={{stepImageUrl(0)}}
  // 合法的雙花括號只出現在 style={{ ... }} 物件字面量，其他屬性不應有此語法
  if (/\b(?!style\b)\w+=\{\{/.test(normalized)) return false;
  // TypeScript compile-check：由呼叫端注入的 checker（通常用 ts.transpileModule）
  if (syntaxChecker && !syntaxChecker(normalized)) return false;
  return true;
}

export async function writeChapterSourcesRaw(
  presentationDir: string,
  input: WriteChapterSourcesInput,
): Promise<void> {
  const chapterDir = join(presentationDir, "src", "chapters", input.folderName);
  await mkdir(chapterDir, { recursive: true });

  const tsx = sanitizeChapterTsx(normalizeChapterTsx(input.chapterTsx, input.componentName));

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
    const normalized = sanitizeChapterTsx(normalizeChapterTsx(raw, componentName));
    if (normalized !== raw) {
      await writeFile(path, normalized, "utf8");
      fixed += 1;
    }
  }
  return fixed;
}

// ─────────────────────────────────────────────────────────────────
//  Phase 5 靜態視覺自檢
// ─────────────────────────────────────────────────────────────────

/** 每個 step 分支內「有意義視覺」的辨識 pattern */
const VISUAL_PATTERN =
  /<svg|<canvas|animation|@keyframes|className=|style=\{|gsap\.|anime\(|lottie|\.animate\(|data-anim|transform|transition/i;

/**
 * 靜態掃描 LLM 生成的 TSX，確認每個 step 分支都有具體視覺動畫。
 * 回傳 pass（全部通過）和哪些 step 不足。
 */
export function checkStepsHaveVisuals(
  tsx: string,
  stepCount: number,
): { pass: boolean; failedSteps: number[] } {
  const failedSteps: number[] = [];
  for (let i = 0; i < stepCount; i++) {
    // 找到 `step === N` 分支：擷取到下一個 `step ===` 或 return/); 前的內容
    const marker = `step === ${i}`;
    const start = tsx.indexOf(marker);
    if (start === -1) {
      failedSteps.push(i);
      continue;
    }
    // 找到下一個 step 標記，限制 chunk 範圍避免跨步驟誤判
    const nextMarker = tsx.indexOf("step ===", start + marker.length);
    const end = nextMarker !== -1 ? nextMarker : Math.min(start + 2000, tsx.length);
    const chunk = tsx.slice(start, end);
    if (!VISUAL_PATTERN.test(chunk)) {
      failedSteps.push(i);
    }
  }
  return { pass: failedSteps.length === 0, failedSteps };
}
