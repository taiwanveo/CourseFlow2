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
}

export function chapterComponentName(wvpChapterId: string): string {
  const parts = wvpChapterId.split("-").filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
