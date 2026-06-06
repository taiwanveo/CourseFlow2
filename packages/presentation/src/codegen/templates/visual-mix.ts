import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import type { StepVisualEntry } from "../step-visuals.js";
import { screenHeadlineForSlot, screenTextOnly, stripNarrationLeakFromScreen } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";
import { buildCodegenStepAnimationBlock } from "../step-image-codegen.js";

/**
 * Visual Mix / VisualBlock 版型 codegen。
 *
 * 這一型不是手寫 JSX 佈局，而是把 stepVisual config 丟給 `VisualBlock` 去渲染。
 * 無 chart/table config 時，若有解說動畫 HTML 則嵌入 iframe。
 */
function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

/** 圖表上方只顯示螢幕短語（禁止口播／步驟說明外洩） */
function visualMixHeadline(screen: string | undefined, title: string): string {
  const cleaned = screen?.trim()
    ? stripNarrationLeakFromScreen(screenTextOnly(screen, title))
    : "";
  const headline = screenHeadlineForSlot(cleaned || title, title, 24);
  return escapeTsString(headline);
}

function stepAnimationEmbedBranch(step: number, componentName: string): string {
  return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`${componentName}-anim-wrap scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <iframe className="${componentName}-anim-frame" src={stepAnimationUrl(${step})} title="" loading="eager" />
      </div>
    );
  }`;
}

export function generateVisualMixSources(
  input: ChapterCodegenInput,
  stepVisuals: StepVisualEntry[],
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const animIndices = input.stepAnimationIndices ?? [];
  const stepAnimationBlock = buildCodegenStepAnimationBlock(input.wvpChapterId, animIndices);
  const configLiteral = stepVisuals
    .map((e) => `  ${e.step}: ${JSON.stringify(e.config)},`)
    .join("\n");

  const stepBranches = input.narrations
    .map((_narration, step) => {
      const cfg = stepVisuals.find((e) => e.step === step);
      const hasAnim = animIndices.includes(step);
      if (cfg) {
        const headline = visualMixHeadline(input.screenContents?.[step], input.title);
        return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <VisualBlock step={step} headline="${headline}" config={STEP_VISUALS[${step}]!} />
      </div>
    );
  }`;
      }
      if (hasAnim) {
        return stepAnimationEmbedBranch(step, componentName);
      }
      return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`${componentName}-fallback scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <p className="serif-cn">${escapeTsString(input.title)}</p>
      </div>
    );
  }`;
    })
    .join("\n");

  const tsx = `import { VisualBlock } from "../../components/VisualBlock";
import type { VisualConfigProp } from "../../components/VisualBlock";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

${stepAnimationBlock}
const STEP_VISUALS: Record<number, VisualConfigProp> = {
${configLiteral}
};
const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;

/** CourseFlow · 宣告式視覺（VisualConfig + VisualBlock） */
export default function ${componentName}({ step }: ChapterStepProps) {
${stepBranches}
  return null;
}
`;

  const css = `.${componentName}-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text);
}
.${componentName}-fallback p {
  margin: 0;
  font-size: clamp(56px, 7vw, 96px);
  line-height: 1.15;
  text-align: center;
  max-width: 92%;
}
.${componentName}-anim-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: var(--space-6) var(--space-8);
  box-sizing: border-box;
}
.${componentName}-anim-frame {
  width: 100%;
  height: 100%;
  min-height: min(72vh, 640px);
  border: none;
  border-radius: var(--r-card, 12px);
  background: transparent;
}
.vf-block {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: var(--space-4);
  padding-top: var(--space-6);
}
.vf-block:has(.vf-chart, .vf-table-wrap) {
  flex: 1;
}
.vf-headline {
  flex-shrink: 0;
  text-align: center;
  width: 100%;
  margin-bottom: var(--space-3);
}
.vf-block:has(.vf-chart) .vf-chart-box {
  flex: 1;
  min-height: min(58vh, 480px);
  display: flex;
  flex-direction: column;
}
`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
    templateKind: "visual-mix" as const,
  };
}
