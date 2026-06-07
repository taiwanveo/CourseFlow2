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
        <SafeAnimationFrame className="${componentName}-anim-frame" srcDoc={stepAnimationSrcDoc(${step})} title="" loading="eager" sandbox="allow-scripts allow-same-origin" />
      </div>
    );
  }`;
}

export function generateVisualMixSources(
  input: ChapterCodegenInput,
  stepVisuals: StepVisualEntry[],
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const animIndices = (input.stepAnimationIndices ?? []).filter((step) =>
    Boolean(input.stepAnimationHtmlByStep?.[step]?.trim()),
  );
  const stepAnimationBlock = buildCodegenStepAnimationBlock(
    input.wvpChapterId,
    animIndices,
    input.stepAnimationHtmlByStep,
  );
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
      const fallbackHeadline = visualMixHeadline(input.screenContents?.[step], input.title);
      return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`${componentName}-fallback scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <p className="serif-cn">${fallbackHeadline}</p>
      </div>
    );
  }`;
    })
    .join("\n");

  const tsx = `import { VisualBlock } from "../../components/VisualBlock";
import type { VisualConfigProp } from "../../components/VisualBlock";
import { SafeAnimationFrame } from "../../components/SafeAnimationFrame";
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

  const css = `/* 1920×1080 舞台：尺寸一律用 base.css --stage-* token，勿用 vh/vw */
.${componentName}-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-height: var(--stage-safe-h);
  color: var(--text);
}
.${componentName}-fallback p {
  margin: 0;
  font-size: 96px;
  line-height: 1.1;
  text-align: center;
  max-width: var(--stage-viz-max-w);
}
.${componentName}-anim-wrap {
  width: 100%;
  max-width: var(--stage-viz-max-w);
  margin-inline: auto;
  flex: 1;
  min-height: 0;
  max-height: calc(var(--stage-safe-h) - var(--stage-headline-band));
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
  box-sizing: border-box;
}
.${componentName}-anim-frame {
  width: 100%;
  height: 100%;
  min-height: 520px;
  max-height: var(--stage-anim-h);
  border: none;
  border-radius: var(--r-card, 12px);
  background: transparent;
}
.vf-block {
  width: 100%;
  height: 100%;
  max-height: var(--stage-safe-h);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: var(--space-3);
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.vf-headline {
  flex-shrink: 0;
  text-align: center;
  width: 100%;
  max-width: var(--stage-viz-max-w);
  margin-inline: auto;
  margin-bottom: var(--space-2);
}
.vf-headline-text {
  font-size: 80px;
}
.vf-block:has(.vf-chart) .vf-chart-box {
  flex: 1;
  min-height: 480px;
  max-height: var(--stage-chart-h);
  display: flex;
  flex-direction: column;
}
.vf-block:has(.vf-table-wrap) .vf-table-wrap {
  flex: 1;
  min-height: 0;
  max-height: calc(var(--stage-safe-h) - var(--stage-headline-band));
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.vf-block:has(.vf-table-wrap) .vf-table-card {
  flex: 1;
  max-height: var(--stage-table-h);
  display: flex;
  flex-direction: column;
  justify-content: center;
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
