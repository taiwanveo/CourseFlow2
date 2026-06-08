import type { CourseComposition } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import { titleToWvpChapterId } from "@/lib/wvp-slug";
import { narrationTextForStep } from "@/lib/wvp-step-text";

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
  return orderedWvpStepsForChapter(composition, chapterId).length;
}

/** WVP 逐步序列：章節分隔頁（若有）置於第 0 步，其後為內容步驟 */
export function orderedWvpStepsForChapter(
  composition: CourseComposition,
  chapterId: string,
) {
  const inChapter = composition.steps
    .filter((s) => s.chapterId === chapterId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const divider = inChapter.find((s) => isChapterStep(s));
  const content = inChapter.filter((s) => !isChapterStep(s));
  if (divider) return [divider, ...content];
  return content;
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

/** WVP 字幕／音訊：每步只取 script（口播稿），禁止用 screenContent 補位 */
export function narrationsForChapter(composition: CourseComposition, chapterId: string) {
  return orderedWvpStepsForChapter(composition, chapterId).map((s) =>
    narrationTextForStep(s),
  );
}
