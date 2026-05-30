import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import { assetsForChapter } from "../hook-slots.js";
import { parseFlowSlots } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";

function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function generateFlowSources(input: ChapterCodegenInput) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const { intro, nodes } = parseFlowSlots(input.narrations, input.screenContents ?? []);
  const chapterAssets = assetsForChapter(input.assets, input.wvpChapterId);
  const assetsLiteral = JSON.stringify(chapterAssets);
  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );

  const tsx = `import { FlowDiagram } from "../../components/FlowDiagram";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

const NODES = ${JSON.stringify(nodes, null, 2)} as const;
const CHECKPOINT_ASSETS = ${assetsLiteral} as { url: string; step?: number }[];
const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;

${stepImageBlock}

function stepImage(step: number) {
  const exact = CHECKPOINT_ASSETS.find((a) => a.step === step);
  const fallback = step === 0 ? CHECKPOINT_ASSETS.find((a) => a.step === 0) : CHECKPOINT_ASSETS[0];
  const hit = exact ?? fallback;
  if (hit?.url?.trim()) return hit.url.trim();
  return stepImageUrl(step);
}

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
      nodes={[...NODES]}
      stepImageUrl={stepImage(step)}
      enterAnimationId={motion.enterAnimationId}
      transitionId={motion.transitionId}
    />
  );
}
`;

  const css = `/* ${componentName} — flow 使用 FlowDiagram 全域樣式 */\n`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
