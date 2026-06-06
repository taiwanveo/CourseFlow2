import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WvpChapterKind } from "@courseflow/core";
import { inferChapterKind } from "./router.js";
import { assetsForChapter } from "./hook-slots.js";
import { generateFlowSources } from "./templates/flow.js";
import { generateHookSources } from "./templates/hook.js";
import { generateListRevealSources } from "./templates/list-reveal.js";
import { generateBeatSceneSources } from "./templates/beat-scene.js";
import { generateMagazineSources } from "./templates/magazine.js";
import { generateVisualMixSources } from "./templates/visual-mix.js";
import type { ChapterCodegenInput } from "./chapter-types.js";

export type { ChapterCodegenInput } from "./chapter-types.js";
export { chapterComponentName } from "./chapter-types.js";
export { inferChapterKind } from "./router.js";

export function resolveChapterTemplate(input: ChapterCodegenInput): WvpChapterKind {
  if (input.forceTemplate) return input.forceTemplate;
  if (input.chapterKind) return input.chapterKind;
  return inferChapterKind({
    chapterTitle: input.title,
    narrations: input.narrations,
    stepVisuals: input.stepVisuals,
    planChapterKind: undefined,
  });
}

export function generateChapterSources(input: ChapterCodegenInput) {
  const kind = resolveChapterTemplate(input);
  /** 已指定版型或 Beat-Scene／Magazine 觸發條件時，不得被 visual-mix 覆蓋 */
  const isBeatSceneDividerOne =
    input.narrations.length === 2 && Boolean(input.screenContents?.[0]?.trim());
  const isSingleStepMagazine = input.narrations.length === 1;
  const templateLocked =
    kind === "hook" ||
    kind === "list-reveal" ||
    kind === "flow" ||
    kind === "magazine" ||
    isBeatSceneDividerOne ||
    isSingleStepMagazine ||
    Boolean(input.forceTemplate);
  const hasUploadedAssets =
    assetsForChapter(input.assets, input.wvpChapterId).length > 0;
  const hasPackagedStepImages =
    Object.keys(input.stepImageExtensions ?? {}).length > 0;
  const visualConfigCount = input.stepVisualConfigs?.length ?? 0;
  const animationConfigCount =
    input.stepVisualConfigs?.filter((e) => e.config.kind === "animation").length ?? 0;
  const minStepsForVisualMix = Math.min(1, input.narrations.length);
  /** 有工作室配圖或強制模板時，不得用 visual-mix（否則畫面完全沒有 step 配圖） */
  const useVisualMix =
    !templateLocked &&
    !hasPackagedStepImages &&
    !hasUploadedAssets &&
    visualConfigCount >= minStepsForVisualMix &&
    (animationConfigCount >= 1 ||
      visualConfigCount >= Math.max(1, Math.ceil(input.narrations.length * 0.2)));
  if (useVisualMix) {
    return {
      ...generateVisualMixSources(input, input.stepVisualConfigs!),
      templateKind: "visual-mix" as const,
    };
  }
  if (kind === "list-reveal" && input.narrations.length >= 2) {
    return { ...generateListRevealSources(input), templateKind: kind };
  }
  if (kind === "flow" && input.narrations.length >= 2) {
    return { ...generateFlowSources(input), templateKind: kind };
  }
  if (kind === "hook") {
    return { ...generateHookSources(input), templateKind: kind };
  }
  if (input.narrations.length >= 2) {
    return { ...generateBeatSceneSources(input), templateKind: "beat-scene" as const };
  }
  return { ...generateMagazineSources(input), templateKind: "magazine" as const };
}

export async function writeChapterToPresentation(
  presentationDir: string,
  input: ChapterCodegenInput,
): Promise<{
  chapterDir: string;
  componentName: string;
  templateKind: string;
  narrations: string[];
}> {
  const chapterDir = join(presentationDir, "src", "chapters", input.folderName);
  await mkdir(chapterDir, { recursive: true });

  const generated = generateChapterSources(input);

  await writeFile(join(chapterDir, generated.componentFileName), generated.tsx, "utf8");
  await writeFile(join(chapterDir, `${generated.componentName}.css`), generated.css, "utf8");
  await writeFile(join(chapterDir, "narrations.ts"), generated.narrationsTs, "utf8");

  return {
    chapterDir,
    componentName: generated.componentName,
    templateKind: generated.templateKind,
    narrations:
      "narrations" in generated && Array.isArray(generated.narrations)
        ? generated.narrations
        : input.narrations,
  };
}
