import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import { mergeStepVisualConfigs, type StepVisualEntry } from "../step-visuals.js";
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

/** 畫面主文：完整螢幕欄位（僅 strip craft 後設，不截斷、不 fallback 口播） */
function visualMixScreenText(screen: string | undefined): string {
  return escapeTsString(screenTextOnly(screen));
}

/** 圖表區小標：收斂為短語，避免與 chart title 重複過長 */
function visualMixChartHeadline(screen: string | undefined): string {
  const cleaned = screen?.trim()
    ? stripNarrationLeakFromScreen(screenTextOnly(screen))
    : "";
  return escapeTsString(screenHeadlineForSlot(cleaned, 24));
}

/** 有解說動畫時仍必須顯示螢幕內容；動畫在下方，不可單獨佔滿整屏 */
function stepAnimationWithScreenBranch(
  step: number,
  componentName: string,
  screenText: string,
): string {
  const headlineBlock = screenText
    ? `<h1 className="${componentName}-screen serif-cn">${screenText}</h1>`
    : "";
  return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    const animDoc = stepAnimationSrcDoc(${step});
    const animCfg = stepAnimationConfig(${step});
    return (
      <div className={\`${componentName}-step-wrap ${componentName}-anim-step scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        ${headlineBlock}
        {(animCfg || animDoc) ? (
          <ExplainAnimationSlot className="${componentName}-anim-frame" animationConfig={animCfg} animationHtml={animDoc} title="" />
        ) : null}
      </div>
    );
  }`;
}

export function generateVisualMixSources(
  input: ChapterCodegenInput,
  stepVisualsInput: StepVisualEntry[],
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const animIndices = (input.stepAnimationIndices ?? []).filter(
    (step) =>
      Boolean(input.stepAnimationConfigByStep?.[step]) ||
      Boolean(input.stepAnimationHtmlByStep?.[step]?.trim()),
  );
  const stepVisuals = mergeStepVisualConfigs(
    input.narrations,
    input.screenContents ?? [],
    stepVisualsInput,
    new Set(animIndices),
  );
  const stepAnimationBlock = buildCodegenStepAnimationBlock(
    input.wvpChapterId,
    animIndices,
    input.stepAnimationHtmlByStep,
    input.stepAnimationConfigByStep,
  );
  const configLiteral = stepVisuals
    .map((e) => `  ${e.step}: ${JSON.stringify(e.config)},`)
    .join("\n");

  const stepBranches = input.narrations
    .map((_narration, step) => {
      const cfg = stepVisuals.find((e) => e.step === step);
      const hasAnim = animIndices.includes(step);
      const screenText = visualMixScreenText(input.screenContents?.[step]);
      if (hasAnim) {
        return stepAnimationWithScreenBranch(step, componentName, screenText);
      }
      if (cfg) {
        const chartHeadline = visualMixChartHeadline(input.screenContents?.[step]);
        return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`${componentName}-step-wrap cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <VisualBlock step={step} headline="${chartHeadline}" config={STEP_VISUALS[${step}]!} />
      </div>
    );
  }`;
      }
      return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`${componentName}-step-wrap ${componentName}-fallback scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <p className="serif-cn">${screenText}</p>
      </div>
    );
  }`;
    })
    .join("\n");

  const tsx = `import { VisualBlock } from "../../components/VisualBlock";
import type { VisualConfigProp } from "../../components/VisualBlock";
import { ExplainAnimationSlot } from "../../components/ExplainAnimationSlot";
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
.${componentName}-step-wrap {
  width: 100%;
  height: 100%;
  min-height: var(--stage-safe-h);
  max-height: var(--stage-safe-h);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}
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
.${componentName}-anim-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}
.${componentName}-screen {
  flex-shrink: 0;
  margin: 0;
  font-size: clamp(40px, 3.6vw, 72px);
  line-height: 1.15;
  text-align: center;
  max-width: var(--stage-viz-max-w);
  color: var(--text);
}
.${componentName}-anim-step .${componentName}-anim-frame {
  width: 100%;
  flex: 1;
  min-height: 280px;
  max-height: calc(var(--stage-safe-h) - var(--stage-headline-band) - 80px);
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
