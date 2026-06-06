import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import type { StepVisualEntry } from "../step-visuals.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * Visual Mix / VisualBlock 版型 codegen。
 *
 * 這一型不是手寫 JSX 佈局，而是把 stepVisual config 丟給 `VisualBlock` 去渲染。
 * 所以標題大小主要看 VisualBlock.css，這個檔案則只決定每一步吃哪份 config。
 */
function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

export function generateVisualMixSources(
  input: ChapterCodegenInput,
  stepVisuals: StepVisualEntry[],
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const configLiteral = stepVisuals
    .map((e) => `  ${e.step}: ${JSON.stringify(e.config)},`)
    .join("\n");

  const stepBranches = input.narrations
    .map((narration, step) => {
      const cfg = stepVisuals.find((e) => e.step === step);
      if (!cfg) {
        return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`${componentName}-fallback scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <p className="serif-cn">${escapeTsString(input.title)}</p>
      </div>
    );
  }`;
      }
      const headline = escapeTsString(
        (input.screenContents?.[step] ?? "").trim().slice(0, 40) ||
          input.title.slice(0, 40),
      );
      return `
  if (step === ${step}) {
    const motion = STEP_MOTIONS[${step}] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
    return (
      <div className={\`cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <VisualBlock step={step} headline="${headline}" config={STEP_VISUALS[${step}]!} />
      </div>
    );
  }`;
    })
    .join("\n");

  const tsx = `import { VisualBlock } from "../../components/VisualBlock";
import type { VisualConfigProp } from "../../components/VisualBlock";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

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
.vf-block {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-5);
}
.vf-block:has(.vf-chart, .vf-table-wrap, .vf-anim) {
  justify-content: flex-start;
  padding-top: var(--space-8);
}
/* 這裡只管 visual-mix 內標題區對齊；真正字級在 VisualBlock.css。 */
.vf-headline {
  flex-shrink: 0;
  text-align: center;
  width: 100%;
}
.vf-block:has(.vf-chart, .vf-table-wrap, .vf-anim) .vf-headline {
  text-align: left;
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
