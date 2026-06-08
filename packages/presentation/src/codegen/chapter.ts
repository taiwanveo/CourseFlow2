import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WvpChapterKind } from "@courseflow/core";
import { inferChapterKind, isDataVisualChapter } from "./router.js";
import type { ChapterCodegenInput } from "./chapter-types.js";
import { buildStepDslFromChapterInput } from "./step-dsl-build.js";
import { generateUniversalStepDslSources } from "./templates/step-dsl-universal.js";

export type { ChapterCodegenInput } from "./chapter-types.js";
export { chapterComponentName } from "./chapter-types.js";
export { inferChapterKind, isDataVisualChapter } from "./router.js";
export { buildStepDslFromChapterInput } from "./step-dsl-build.js";

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

/** StepDSL v1：所有章節統一走 UniversalStepChapter，不再產 per-step if/else TSX */
export function generateChapterSources(input: ChapterCodegenInput) {
  const chapterDsl = buildStepDslFromChapterInput(input);
  return {
    ...generateUniversalStepDslSources(input, chapterDsl),
    templateKind: chapterDsl.templateKind,
  };
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
  if ("dslFileName" in generated && "dslTs" in generated) {
    await writeFile(join(chapterDir, generated.dslFileName), generated.dslTs, "utf8");
  }

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
