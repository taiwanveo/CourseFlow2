import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WvpChapterKind } from "@courseflow/core";
import { inferChapterKind } from "./router.js";
import { assetsForChapter } from "./hook-slots.js";
import { generateFlowSources } from "./templates/flow.js";
import { generateHookSources } from "./templates/hook.js";
import { generateListRevealSources } from "./templates/list-reveal.js";
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
  const hasUploadedAssets =
    assetsForChapter(input.assets, input.wvpChapterId).length > 0;
  const useVisualMix =
    !hasUploadedAssets &&
    input.stepVisualConfigs &&
    input.stepVisualConfigs.length > 0 &&
    kind !== "list-reveal" &&
    kind !== "flow" &&
    kind !== "hook";
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
