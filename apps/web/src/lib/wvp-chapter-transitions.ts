import type { WvpChapterKind } from "@courseflow/core";

/** 步間／章間轉場 ID（與 motion-presets stepTransitionVariants 對齊） */
export const STEP_TRANSITION_IDS = [
  "crossfade",
  "fade",
  "wipe",
  "slide-left",
  "slide-right",
  "none",
] as const;

export type StepTransitionId = (typeof STEP_TRANSITION_IDS)[number];

export const STEP_TRANSITION_LABELS: Record<StepTransitionId, string> = {
  crossfade: "交叉淡化",
  fade: "淡入淡出",
  wipe: "捲簾揭幕",
  "slide-left": "左滑入場",
  "slide-right": "右滑入場",
  none: "無轉場",
};

/** transitionId 循環 — 步間轉場節奏有起伏，避免連續相同效果 */
export const TRANSITION_CYCLE: StepTransitionId[] = [
  "crossfade",
  "wipe",
  "slide-left",
  "fade",
  "slide-right",
  "crossfade",
  "wipe",
  "slide-right",
  "fade",
];

/** 依進入章節版型建議章間轉場 */
const BOUNDARY_TRANSITION_BY_KIND: Partial<Record<WvpChapterKind, StepTransitionId>> = {
  flow: "slide-right",
  hook: "wipe",
  "list-reveal": "fade",
  magazine: "slide-left",
};

export function suggestChapterBoundaryTransition(
  prevKind?: WvpChapterKind,
  nextKind?: WvpChapterKind,
): StepTransitionId {
  if (nextKind && BOUNDARY_TRANSITION_BY_KIND[nextKind]) {
    return BOUNDARY_TRANSITION_BY_KIND[nextKind]!;
  }
  if (prevKind && BOUNDARY_TRANSITION_BY_KIND[prevKind]) {
    return BOUNDARY_TRANSITION_BY_KIND[prevKind]!;
  }
  return "crossfade";
}

/** 依章節數產生預設章間轉場（長度 = chapterCount − 1，無版型資訊時輪替） */
export function defaultChapterTransitions(chapterCount: number): StepTransitionId[] {
  if (chapterCount <= 1) return [];
  return Array.from({ length: chapterCount - 1 }, (_, i) => {
    return TRANSITION_CYCLE[i % TRANSITION_CYCLE.length] ?? "crossfade";
  });
}

/** 依各章 chapterKind 產生建議章間轉場（長度 = kinds.length − 1） */
export function defaultChapterTransitionsForKinds(
  chapterKinds: (WvpChapterKind | undefined)[],
): StepTransitionId[] {
  if (chapterKinds.length <= 1) return [];
  const gaps: StepTransitionId[] = [];
  for (let i = 0; i < chapterKinds.length - 1; i++) {
    gaps.push(suggestChapterBoundaryTransition(chapterKinds[i], chapterKinds[i + 1]));
  }
  return gaps;
}

const ALLOWED_STEP_TRANSITIONS = new Set<string>(STEP_TRANSITION_IDS);

export function isStepTransitionId(value: string): value is StepTransitionId {
  return ALLOWED_STEP_TRANSITIONS.has(value);
}

/** 合併使用者設定與預設章間轉場 */
export function resolveChapterTransitions(
  chapterCount: number,
  saved?: string[] | null,
  chapterKinds?: (WvpChapterKind | undefined)[],
): StepTransitionId[] {
  const defaults =
    chapterKinds && chapterKinds.length === chapterCount
      ? defaultChapterTransitionsForKinds(chapterKinds)
      : defaultChapterTransitions(chapterCount);
  if (!saved?.length) return defaults;
  return defaults.map((fallback, i) => {
    const raw = saved[i];
    return raw && isStepTransitionId(raw) ? raw : fallback;
  });
}
