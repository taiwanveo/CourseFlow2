import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WvpChapterKind } from "@courseflow/core";
import { inferChapterKind, isDataVisualChapter } from "./router.js";
import { buildHeuristicStepVisualConfigs, type StepVisualEntry } from "./step-visuals.js";
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
export { inferChapterKind, isDataVisualChapter } from "./router.js";

export function resolveChapterTemplate(input: ChapterCodegenInput): WvpChapterKind {
  if (input.forceTemplate) return input.forceTemplate;
  if (input.chapterKind) return input.chapterKind;
  return inferChapterKind({
    chapterTitle: input.title,
    narrations: input.narrations,
    stepVisuals: input.stepVisuals,
    planChapterKind: undefined,
    screenContents: input.screenContents,
  });
}

function hasChartOrTableVisuals(
  configs: ChapterCodegenInput["stepVisualConfigs"],
): boolean {
  return (
    configs?.some((e) => e.config.kind === "chart" || e.config.kind === "table") ?? false
  );
}

function resolveDataVisualConfigs(input: ChapterCodegenInput): StepVisualEntry[] {
  const heuristic = buildHeuristicStepVisualConfigs(
    input.narrations,
    input.screenContents ?? [],
  );
  /** 啟發式優先：LLM 常把季度折線放到方案步、或把營收步做成 reveal-list 動畫 */
  if (heuristic.length > 0) return heuristic;
  return (input.stepVisualConfigs ?? []).filter(
    (e) => e.config.kind === "chart" || e.config.kind === "table",
  );
}

export function generateChapterSources(input: ChapterCodegenInput) {
  const hasUploadedAssets =
    assetsForChapter(input.assets, input.wvpChapterId).length > 0;
  const hasPackagedStepImages =
    Object.keys(input.stepImageExtensions ?? {}).length > 0;
  const isBeatSceneDividerOne =
    input.narrations.length === 2 && Boolean(input.screenContents?.[0]?.trim());
  /** 分隔頁 + 1 內容步：固定 Beat-Scene，不得被 Visual-Mix 蓋掉 */
  if (
    isBeatSceneDividerOne &&
    !hasPackagedStepImages &&
    !hasUploadedAssets &&
    !input.forceTemplate
  ) {
    return { ...generateBeatSceneSources(input), templateKind: "beat-scene" as const };
  }
  const dataVisualChapter = isDataVisualChapter({
    chapterTitle: input.title,
    narrations: input.narrations,
    screenContents: input.screenContents,
  });
  const visualConfigs = input.stepVisualConfigs ?? [];
  const visualConfigCount = visualConfigs.length;

  /** 數據視覺章：無配圖時強制 Visual-Mix（含啟發式 chart/table），不走 list/flow */
  const dataVisualMixConfigs =
    dataVisualChapter && !hasPackagedStepImages && !hasUploadedAssets
      ? resolveDataVisualConfigs(input)
      : [];
  if (dataVisualMixConfigs.length > 0) {
    return {
      ...generateVisualMixSources(input, dataVisualMixConfigs),
      templateKind: "visual-mix" as const,
    };
  }

  const kind = resolveChapterTemplate(input);
  if (kind === "flow" && input.narrations.length >= 2) {
    return { ...generateFlowSources(input), templateKind: kind };
  }
  if (kind === "list-reveal" && input.narrations.length >= 2) {
    return { ...generateListRevealSources(input), templateKind: kind };
  }
  if (kind === "hook") {
    return { ...generateHookSources(input), templateKind: kind };
  }
  /** 已指定版型或 Beat-Scene／Magazine 觸發條件時，不得被 visual-mix 覆蓋 */
  const isSingleStepMagazine = input.narrations.length === 1;
  const templateLocked =
    kind === "magazine" ||
    isBeatSceneDividerOne ||
    isSingleStepMagazine ||
    Boolean(input.forceTemplate);
  const animationConfigCount =
    visualConfigs.filter((e) => e.config.kind === "animation").length;
  const minStepsForVisualMix = Math.min(1, input.narrations.length);
  /** 僅 custom 等未鎖定版型可用 LLM 視覺 config 走 visual-mix */
  const useVisualMix =
    !templateLocked &&
    !hasPackagedStepImages &&
    !hasUploadedAssets &&
    visualConfigCount >= minStepsForVisualMix &&
    (animationConfigCount >= 1 ||
      visualConfigCount >= Math.max(1, Math.ceil(input.narrations.length * 0.2)));
  if (useVisualMix) {
    return {
      ...generateVisualMixSources(input, visualConfigs),
      templateKind: "visual-mix" as const,
    };
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
