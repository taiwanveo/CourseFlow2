import type { WvpChapterKind, WvpStepVisualPlan } from "@courseflow/core";

export interface ChapterCodegenInput {
  folderName: string;
  wvpChapterId: string;
  title: string;
  narrations: string[];
  visualIdeas?: string[];
  stepBeats?: { step: number; dominantAction?: string }[];
  stepVisuals?: WvpStepVisualPlan[];
  screenContents?: string[];
  chapterKind?: WvpChapterKind;
  forceTemplate?: WvpChapterKind;
  assets?: { url: string; alt?: string; step?: number; wvpChapterId?: string }[];
  stepVisualConfigs?: import("./step-visuals.js").StepVisualEntry[];
  stepMotions?: { enterAnimationId: string; transitionId: string }[];
  /** 各步驟配圖副檔名（如 gif、png）；未列出的步驟預設 jpg */
  stepImageExtensions?: Record<number, string>;
  /** 有動畫 HTML 檔的步驟索引清單（對應 public/animations/<wvpChapterId>/<NN>.html） */
  stepAnimationIndices?: number[];
  /** 打包時內嵌至章節 TSX 的動畫 HTML（避免預覽 iframe 遠端載入失敗） */
  stepAnimationHtmlByStep?: Partial<Record<number, string>>;
  /** Phase 3：DSL → Framer Motion 場景（優先於 HTML） */
  stepAnimationConfigByStep?: Partial<Record<number, Record<string, unknown>>>;
}

export function chapterComponentName(wvpChapterId: string): string {
  const parts = wvpChapterId.split("-").filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/**
 * 從 wvpChapterId 產生可讀的章節 kicker 標籤（顯示在畫面左上角）。
 * "chapter-04" → "ch. 04"  (CSS text-transform: uppercase → "CH. 04")
 * "chapter-1"  → "ch. 01"
 * 其他格式      → 原值前 20 字
 */
export function deriveChapterKicker(wvpChapterId: string): string {
  const m = wvpChapterId.match(/(\d+)$/);
  if (m && m[1]) return `ch. ${m[1].padStart(2, "0")}`;
  return wvpChapterId.slice(0, 20);
}
