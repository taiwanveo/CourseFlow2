import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import { assetsForChapter } from "../hook-slots.js";
import { parseFlowSlots } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";
import { buildCodegenStepImageBlock, buildCodegenStepAnimationBlock } from "../step-image-codegen.js";

/**
 * 流程圖版型（flow）的 codegen。
 *
 * 這個檔案負責把章節拆成 `intro + nodes`，再餵給 FlowDiagram。
 * 版面比例、導言字級、右側圖片框高度等視覺旋鈕，主要在 FlowDiagram.css。
 */
function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function generateFlowSources(input: ChapterCodegenInput) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const { intro, introSub, nodes } = parseFlowSlots(input.narrations, input.screenContents ?? []);
  const chapterAssets = assetsForChapter(input.assets, input.wvpChapterId);
  const assetsLiteral = JSON.stringify(chapterAssets);
  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );
  const animIndices = input.stepAnimationIndices ?? [];
  const stepAnimationBlock = buildCodegenStepAnimationBlock(
    input.wvpChapterId,
    animIndices,
    input.stepAnimationHtmlByStep,
  );
  const stepAnimationHelper =
    animIndices.length > 0
      ? `function stepAnimationHtml(step: number) {
  return hasStepAnimation(step) ? stepAnimationSrcDoc(step) : undefined;
}`
      : `function stepAnimationHtml(_step: number) {
  return undefined;
}`;

  const tsx = `import { FlowDiagram } from "../../components/FlowDiagram";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

const NODES = ${JSON.stringify(nodes, null, 2)} as const;
const CHECKPOINT_ASSETS = ${assetsLiteral} as { url: string; step?: number }[];
const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;

${stepImageBlock}${stepAnimationBlock}
function stepImage(step: number) {
  // 流程圖的右側圖像來源優先序：當步 checkpoint → 章節 fallback → step image。
  const exact = CHECKPOINT_ASSETS.find((a) => a.step === step);
  const fallback = step === 0 ? CHECKPOINT_ASSETS.find((a) => a.step === 0) : CHECKPOINT_ASSETS[0];
  const hit = exact ?? fallback;
  if (hit?.url?.trim()) return hit.url.trim();
  return stepImageUrl(step);
}

${stepAnimationHelper}

function stepMotion(step: number) {
  return STEP_MOTIONS[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
}

/** CourseFlow · 流程動畫（每步點亮一節點 + 側欄配圖） */
export default function ${componentName}({ step }: ChapterStepProps) {
  const motion = stepMotion(step);
  return (
    <FlowDiagram
      step={step}
      chapterTitle={${JSON.stringify(deriveChapterKicker(input.wvpChapterId))}}
      intro={${JSON.stringify(intro)}}
      introSub={${JSON.stringify(introSub)}}
      nodes={[...NODES]}
      stepImageUrl={stepImage(step)}
      stepAnimationHtml={stepAnimationHtml(step)}
      enterAnimationId={motion.enterAnimationId}
      transitionId={motion.transitionId}
    />
  );
}
`;

  // flow 版型的主要樣式也集中在 vendor CSS，這裡只保留掛鉤。
  const css = `/* ${componentName} — flow 使用 FlowDiagram 全域樣式 */\n`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
