import type { CourseComposition } from "@courseflow/core";
import {
  parseChapterMotionOrientation,
  planChapterMotionCoverage,
  type ChapterMotionPlan,
} from "@courseflow/explain-animation";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import {
  resolveCompositionChapterForCraft,
  screenContentsForChapter,
} from "@/lib/wvp-chapter-meta";

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  checklist_result?: unknown;
};

/** 僅讀 checklist JSON，避免 client 匯入 wvp-craft-illustrations（含 node:fs） */
function stepIllustrationsFromChecklist(craft: CraftRow) {
  const cr = craft.checklist_result as {
    stepIllustrations?: Array<{
      stepIndex: number;
      imageSource?: string;
      animationHtml?: string | null;
      animationStoragePath?: string | null;
    }>;
  } | null;
  return cr?.stepIllustrations ?? [];
}

export type ProjectMotionPlan = {
  totalSteps: number;
  explainStepCount: number;
  fallbackStepCount: number;
  noneStepCount: number;
  craftAnimationStepCount: number;
  chapters: ChapterMotionPlan[];
  warnings: string[];
};

export function evaluateProjectMotionPlan(
  composition: CourseComposition,
  crafts: CraftRow[],
): ProjectMotionPlan {
  const chapters: ChapterMotionPlan[] = [];
  const warnings: string[] = [];
  let totalSteps = 0;
  let explainStepCount = 0;
  let fallbackStepCount = 0;
  let noneStepCount = 0;
  let craftAnimationStepCount = 0;

  for (const craft of crafts) {
    const chapter = resolveCompositionChapterForCraft(composition, craft);
    const checklist = craft.checklist_result as { narrations?: string[]; motionOrientation?: unknown } | null;
    const narrations =
      chapter && composition
        ? narrationsForChapter(composition, chapter.id)
        : (checklist?.narrations ?? []);
    const screenContents = chapter
      ? screenContentsForChapter(composition, chapter.id)
      : [];
    if (narrations.length === 0) continue;

    const plan = planChapterMotionCoverage({
      wvpChapterId: craft.wvp_chapter_id,
      title: craft.title,
      orientation: parseChapterMotionOrientation(checklist?.motionOrientation),
      narrations,
      screenContents,
      stepIllustrations: stepIllustrationsFromChecklist(craft),
    });

    chapters.push(plan);
    totalSteps += plan.totalSteps;
    explainStepCount += plan.explainStepCount;
    fallbackStepCount += plan.fallbackStepCount;
    noneStepCount += plan.noneStepCount;
    craftAnimationStepCount += plan.craftAnimationStepCount;
    for (const w of plan.warnings) {
      warnings.push(`「${craft.title}」${w}`);
    }
  }

  return {
    totalSteps,
    explainStepCount,
    fallbackStepCount,
    noneStepCount,
    craftAnimationStepCount,
    chapters,
    warnings,
  };
}
