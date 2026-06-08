import type { StepDslChapter } from "../../step-dsl/schema.js";
import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { buildCodegenStepAnimationBlock } from "../step-image-codegen.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * StepDSL v1 通用章節 codegen：不再產 per-step if/else TSX，改輸出資料 + UniversalStepChapter。
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
  const animIndices = (input.stepAnimationIndices ?? []).filter(
    (step) =>
      Boolean(input.stepAnimationConfigByStep?.[step]) ||
      Boolean(input.stepAnimationHtmlByStep?.[step]?.trim()),
  );
  const stepAnimationBlock = buildCodegenStepAnimationBlock(
    input.wvpChapterId,
    animIndices,
    input.stepAnimationHtmlByStep,
    input.stepAnimationConfigByStep,
  );

  const dslTs = `import type { StepDslChapterData } from "../../components/step-dsl-types";

/** StepDSL v1 — 由 CourseFlow codegen 產生，勿手改 */
export const STEP_DSL_CHAPTER: StepDslChapterData = ${JSON.stringify(chapterDsl, null, 2)} as const;
`;

  const tsx = `import { UniversalStepChapter } from "../../components/UniversalStepChapter";
import type { ChapterStepProps } from "../../registry/types";
import { STEP_DSL_CHAPTER } from "./step-dsl-data";
import "./${componentName}.css";

${stepImageBlock}${stepAnimationBlock}

/** CourseFlow · StepDSL v1 通用 StepRenderer */
export default function ${componentName}({ step }: ChapterStepProps) {
  return (
    <UniversalStepChapter
      step={step}
      chapter={STEP_DSL_CHAPTER}
      stepImageUrl={stepImageUrl}
      hasStepAnimation={hasStepAnimation}
      stepAnimationConfig={stepAnimationConfig}
      stepAnimationSrcDoc={stepAnimationSrcDoc}
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
