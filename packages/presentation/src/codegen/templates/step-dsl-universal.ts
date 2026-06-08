import type { StepDslChapter } from "../../step-dsl/schema.js";
import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * StepDSL v1 通用章節 codegen：動畫以 step-dsl-data.explain 為唯一真相來源，不再內嵌 STEP_ANIMATION_*。
 */
export function generateUniversalStepDslSources(
  input: ChapterCodegenInput,
  chapterDsl: StepDslChapter,
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );

  const dslTs = `import type { StepDslChapterData } from "../../components/step-dsl-types";

/** StepDSL v1 — 由 CourseFlow codegen 產生，勿手改 */
export const STEP_DSL_CHAPTER: StepDslChapterData = ${JSON.stringify(chapterDsl, null, 2)} as const;
`;

  const tsx = `import { UniversalStepChapter } from "../../components/UniversalStepChapter";
import type { ChapterStepProps } from "../../registry/types";
import { STEP_DSL_CHAPTER } from "./step-dsl-data";
import "./${componentName}.css";

${stepImageBlock}

/** CourseFlow · StepDSL v1 通用 StepRenderer（動畫僅讀 step-dsl-data） */
export default function ${componentName}({ step }: ChapterStepProps) {
  return (
    <UniversalStepChapter
      step={step}
      chapter={STEP_DSL_CHAPTER}
      stepImageUrl={stepImageUrl}
    />
  );
}
`;

  const css = `/* ${componentName} — StepDSL 通用版型 */\n`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    dslFileName: "step-dsl-data.ts",
    dslTs,
    narrationsTs: buildNarrationsTs(input),
    narrations: input.narrations,
    templateKind: chapterDsl.templateKind,
  };
}
