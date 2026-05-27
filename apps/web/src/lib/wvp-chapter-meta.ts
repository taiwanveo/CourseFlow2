import type { CourseComposition, WvpChapterKind } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import { inferChapterKind } from "@courseflow/presentation";

export function screenContentsForChapter(
  composition: CourseComposition,
  chapterId: string,
): string[] {
  return composition.steps
    .filter((s) => s.chapterId === chapterId && !isChapterStep(s))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.screenContent?.trim() || s.script?.trim() || "");
}

export function chapterKindForCraft(
  composition: CourseComposition,
  chapterId: string,
  chapterTitle: string,
  narrations: string[],
  aiPlan?: Record<string, unknown>,
): WvpChapterKind {
  const ch = composition.chapters.find((c) => c.id === chapterId);
  if (ch?.chapterKind) return ch.chapterKind;
  const planKind = (aiPlan?.chapterKind as string) ?? undefined;
  return inferChapterKind({
    chapterTitle,
    narrations,
    stepVisuals: (aiPlan?.stepVisuals as { step: number; vizType?: string }[]) ?? [],
    planChapterKind: planKind,
  });
}
