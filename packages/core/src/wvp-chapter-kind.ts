/** WVP 章節視覺型別（對應 Skill EXAMPLES / 解說片段落） */
export type WvpChapterKind = "list-reveal" | "flow" | "hook" | "magazine";

export type WvpVizType = WvpChapterKind | "compare" | "quote-hero" | "custom";

export interface WvpStepVisualPlan {
  step: number;
  concept?: string;
  vizType?: string;
  onScreen?: string;
}

export interface WvpChapterPlanMeta {
  chapterKind?: WvpChapterKind;
  visualIdeas?: string[];
  stepVisuals?: WvpStepVisualPlan[];
  stepBeats?: { step: number; dominantAction?: string }[];
}
