import type { CourseComposition } from "@courseflow/core";
import { getOrderedSteps, isChapterStep } from "@courseflow/core";
import { titleToWvpChapterId } from "@/lib/wvp-slug";

export interface ChapterCraftRow {
  id: string;
  wvp_chapter_id: string;
  title: string;
  craft_status: string;
  step_count: number;
  sort_order: number;
  checklist_result?: unknown;
}

export function contentChaptersFromComposition(composition: CourseComposition) {
  return composition.chapters
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function stepCountForChapter(composition: CourseComposition, chapterId: string) {
  return composition.steps.filter(
    (s) => s.chapterId === chapterId && !isChapterStep(s),
  ).length;
}

export function buildChapterCraftPlan(composition: CourseComposition) {
  const roots = contentChaptersFromComposition(composition);
  return roots.map((ch, i) => ({
    wvpChapterId: titleToWvpChapterId(ch.title, i),
    title: ch.title,
    chapterId: ch.id,
    stepCount: stepCountForChapter(composition, ch.id),
    sortOrder: ch.sortOrder,
  }));
}

export function narrationsForChapter(composition: CourseComposition, chapterId: string) {
  const ordered = getOrderedSteps(composition);
  return composition.steps
    .filter((s) => s.chapterId === chapterId && !isChapterStep(s))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.script.trim() || s.screenContent.trim());
}
