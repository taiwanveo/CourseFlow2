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
}

export function chapterComponentName(wvpChapterId: string): string {
  const parts = wvpChapterId.split("-").filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
