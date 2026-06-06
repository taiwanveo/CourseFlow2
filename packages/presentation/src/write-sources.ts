import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  chapterBindsNarrationText,
  chapterCoversAllSteps,
  chapterUsesInvalidMaskReveal,
  hasVisualDemoInSources,
} from "./visual-demo.js";

export type ChapterTsxValidationIssue =
  | "missing-export"
  | "missing-step-props"
  | "missing-css-import"
  | "missing-component-name"
  | "invalid-mask-reveal"
  | "no-visual-demo"
  | "narration-not-bound"
  | "narration-leaked-to-jsx"
  | "craft-metadata-leaked-to-jsx"
  | "incomplete-steps"
  | "extra-step-branch"
  | "too-short"
  | "invalid-jsx-prop"
  | "syntax-error";

/** LLM 產碼常把 craft 上下文（章節標題、【畫面 N】）誤貼進 JSX */
export function craftMetadataLeakedInTsx(tsx: string): boolean {
  return /章節：|【畫面\s*\d+】|→\s*畫面：/.test(tsx);
}

export function validateChapterTsxIssues(
  tsx: string,
  stepCount: number,
  componentName: string,
  chapterCss = "",
  narrations: string[] = [],
  syntaxChecker?: (code: string) => boolean,
): ChapterTsxValidationIssue[] {
  const issues: ChapterTsxValidationIssue[] = [];
  const normalized = normalizeChapterTsx(tsx, componentName);
  if (!normalized.includes("export default function")) issues.push("missing-export");
  if (!normalized.includes("ChapterStepProps")) issues.push("missing-step-props");
  if (!normalized.includes(`./${componentName}.css`)) issues.push("missing-css-import");
  if (!normalized.includes(`function ${componentName}`)) issues.push("missing-component-name");
  if (chapterUsesInvalidMaskReveal(normalized)) issues.push("invalid-mask-reveal");
  if (!hasVisualDemoInSources(normalized, chapterCss)) issues.push("no-visual-demo");
  if (narrations.length > 0 && !chapterBindsNarrationText(normalized, narrations)) {
    issues.push("narration-not-bound");
  }
  for (const narration of narrations) {
    if (narration.length > 28 && normalized.includes(narration)) {
      issues.push("narration-leaked-to-jsx");
      break;
    }
  }
  if (craftMetadataLeakedInTsx(normalized)) {
    issues.push("craft-metadata-leaked-to-jsx");
  }
  if (!chapterCoversAllSteps(normalized, stepCount)) {
    if (normalized.includes(`step === ${stepCount}`)) issues.push("extra-step-branch");
    else issues.push("incomplete-steps");
  }
  if (normalized.length <= 160) issues.push("too-short");
  if (/\b(?!style\b)\w+=\{\{/.test(normalized)) issues.push("invalid-jsx-prop");
  if (syntaxChecker && !syntaxChecker(normalized)) issues.push("syntax-error");
  return issues;
}

export interface WriteChapterSourcesInput {
  folderName: string;
  componentName: string;
  narrations: string[];
  chapterTsx: string;
  chapterCss: string;
}

/** WVP 模板元件皆為 named export；LLM 常誤寫 default import */
const NAMED_TEMPLATE_COMPONENTS = [
  "MaskReveal",
  "ListRevealGrid",
  "FlowDiagram",
  "HookImageStrip",
  "VisualBlock",
  "ChapterFigure",
  "NarrationBeat",
] as const;

function fixDefaultComponentImports(tsx: string): string {
  let out = tsx;
  for (const symbol of NAMED_TEMPLATE_COMPONENTS) {
    out = out.replace(
      new RegExp(`import\\s+${symbol}\\s+from\\s+(["'])([^"']+)\\1;`, "g"),
      `import { ${symbol} } from $1$2$1;`,
    );
  }
  return out;
}

/** 修正 LLM 常見錯誤：Chapter.css、函式名稱與檔名不一致 */
export function normalizeChapterTsx(tsx: string, componentName: string): string {
  let out = fixDefaultComponentImports(tsx.trim());

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
  return (
    validateChapterTsxIssues(
      tsx,
      stepCount,
      componentName,
      chapterCss,
      narrations,
      syntaxChecker,
    ).length === 0
  );
}

const VALIDATION_ISSUE_HINTS: Record<ChapterTsxValidationIssue, string> = {
  "missing-export": "必須 export default function <ComponentName>",
  "missing-step-props": "必須 import type { ChapterStepProps }",
  "missing-css-import": "必須 import \"./<ComponentName>.css\"",
  "missing-component-name": "函式名稱必須與檔名一致",
  "invalid-mask-reveal": "MaskReveal 必須用 show prop，禁止 title= prop",
  "no-visual-demo": "每章需含 SVG/@keyframes/MaskReveal/ListRevealGrid/FlowDiagram 等視覺演示",
  "narration-not-bound": "需為每個 step 提供畫面（if(step===N) 或 ListRevealGrid/FlowDiagram step prop）",
  "narration-leaked-to-jsx": "禁止把口播全文複製進 JSX，畫面只用 screenContents 短語",
  "craft-metadata-leaked-to-jsx":
    "禁止把 craft 上下文（章節：、【畫面 N】）貼進 JSX，畫面只用螢幕內容短語",
  "incomplete-steps": "缺少部分 step 分支；請補齊 step 0 到 step N-1",
  "extra-step-branch": "禁止多餘的 step === N 分支（超出口播步數）",
  "too-short": "程式過短，請補齊每步視覺演示",
  "invalid-jsx-prop": "禁止 url={{expr}} 雙花括號（style={{}} 除外）",
  "syntax-error": "TypeScript/JSX 語法錯誤，請修正後重輸出",
};

export function formatChapterTsxValidationFeedback(
  issues: ChapterTsxValidationIssue[],
): string {
  if (issues.length === 0) return "";
  return issues.map((id) => `- ${VALIDATION_ISSUE_HINTS[id]}`).join("\n");
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
  if (/ListRevealGrid|FlowDiagram|HookImageStrip|VisualBlock/.test(tsx)) {
    return { pass: true, failedSteps: [] };
  }
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
