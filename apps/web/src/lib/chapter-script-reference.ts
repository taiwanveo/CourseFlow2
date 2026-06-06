import type { CourseComposition } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import { buildChapterCraftPlan, orderedWvpStepsForChapter } from "@/lib/wvp-chapters";

export type ChapterScriptStep = {
  label: string;
  screen: string;
  script: string;
};

/** 依 wvp 章節 ID 取出文稿階段最新螢幕內容與口播稿，供配圖參考 */
export function chapterScriptSteps(
  composition: CourseComposition,
  wvpChapterId: string,
  sortOrder: number,
): ChapterScriptStep[] {
  const plan = buildChapterCraftPlan(composition);
  const entry =
    plan.find((p) => p.wvpChapterId === wvpChapterId) ?? plan[sortOrder];
  if (!entry) return [];

  let contentIndex = 0;
  return orderedWvpStepsForChapter(composition, entry.chapterId).map((step) => {
    if (isChapterStep(step)) {
      return {
        label: "章節分隔",
        screen: step.screenContent.trim(),
        script: step.script.trim(),
      };
    }
    contentIndex += 1;
    return {
      label: `步驟 ${contentIndex}`,
      screen: step.screenContent.trim(),
      script: step.script.trim(),
    };
  });
}
