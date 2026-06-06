import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import { splitHeadlineForStaggeredReveal } from "../content-aware.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { assetForStep, assetsForChapter } from "../hook-slots.js";
import { screenTextOnly } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * Beat Scene 版型：每步獨立全屏，主標分段 MaskReveal + 內容感知裝飾（類 demo 解說節拍）。
 * 作為 magazine 的強化替代，用於 2+ 步且未命中 list-reveal/flow 的章節。
 */
function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cssPrefix(wvpChapterId: string): string {
  return `ch-${wvpChapterId.replace(/[^a-z0-9-]/gi, "-")}`;
}

const CONTRAST_RE = /對比|对比|差異|相比|另一方面|相對|vs|VS|優於|劣於/i;
const METRIC_RE = /\d+%|百分之|倍|成長|遞增|递减|計數|數字|從\s*0/i;

function beatAccentClass(screen: string, narration: string): string {
  const blob = `${screen} ${narration}`;
  if (CONTRAST_RE.test(blob)) return "bs-accent-contrast";
  if (METRIC_RE.test(blob)) return "bs-accent-metric";
  if (/強調|關鍵|核心|重點|金句/.test(blob)) return "bs-accent-quote";
  return "bs-accent-default";
}

function beatDecoration(screen: string, narration: string, prefix: string): string {
  const blob = `${screen} ${narration}`;
  if (CONTRAST_RE.test(blob)) {
    return `
        <div className="${prefix}-contrast" data-no-advance aria-hidden>
          <span className="${prefix}-contrast-left" />
          <span className="${prefix}-contrast-right" />
        </div>`;
  }
  if (METRIC_RE.test(blob)) {
    const m = blob.match(/\d+(?:\.\d+)?%?/);
    const num = m?.[0] ?? "—";
    return `
        <div className="${prefix}-metric" data-no-advance aria-hidden>
          <span className="${prefix}-metric-num hero-num">${escapeTsString(num)}</span>
        </div>`;
  }
  return `
        <div className="${prefix}-pulse" data-no-advance aria-hidden>
          <span className="${prefix}-pulse-ring" />
        </div>`;
}

function stepSceneBlock(
  stepIndex: number,
  intro: string,
  introSub: string,
  prefix: string,
  screen: string,
  narration: string,
  figureLine: string,
  kickerLabel?: string,
): string {
  const kickerExpr = kickerLabel
    ? JSON.stringify(kickerLabel)
    : "CHAPTER_KICKER";
  const accent = beatAccentClass(screen, narration);
  const deco = beatDecoration(screen, narration, prefix);
  const subBlock = introSub
    ? `
          <br />
          <MaskReveal show delay={400} duration={900}>
            <span className={\`${prefix}-headline-sub ${accent}\`}>${escapeTsString(introSub)}</span>
          </MaskReveal>`
    : "";
  return `
  if (step === ${stepIndex}) {
    return (
      <div className={\`${prefix}-scene scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <div className="${prefix}-main">
          <div className="${prefix}-kicker label-mono">{CHAPTER_KICKER}</div>
          <h1 className={\`${prefix}-headline serif-cn\`}>
            <MaskReveal show duration={1000}>
              <span>${escapeTsString(intro)}</span>
            </MaskReveal>${subBlock}
          </h1>${deco}
        </div>
        ${figureLine}
      </div>
    );
  }`;
}

export function generateBeatSceneSources(input: ChapterCodegenInput) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const prefix = cssPrefix(input.wvpChapterId);
  const chapterAssets = assetsForChapter(input.assets, input.wvpChapterId);
  const kicker = deriveChapterKicker(input.wvpChapterId);
  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );

  /** 分隔頁 + 單一內容步：合併為一步全屏節拍（避免先點一次只有小標） */
  const isDividerPlusOne =
    input.narrations.length === 2 && Boolean(input.screenContents?.[0]?.trim());
  const workNarrations = isDividerPlusOne
    ? [input.narrations[1]!]
    : input.narrations;
  const workScreens = isDividerPlusOne
    ? [input.screenContents?.[1] ?? ""]
    : (input.screenContents ?? []);
  const dividerKicker = isDividerPlusOne
    ? screenTextOnly(input.screenContents?.[0], input.title)
    : undefined;
  const workMotions = isDividerPlusOne
    ? [input.stepMotions?.[1] ?? input.stepMotions?.[0] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" }]
    : (input.stepMotions ?? []);

  const scenes = workNarrations.map((narration, stepIndex) => {
    const screen = workScreens[stepIndex] ?? "";
    const headline = screenTextOnly(screen, "重點");
    const hasScreen = Boolean(screen.trim());
    const parts = hasScreen ? splitHeadlineForStaggeredReveal(headline, 2) : [];
    const intro = parts[0] ?? headline;
    const introSub = parts[1] ?? "";
    const assetStepIndex = isDividerPlusOne ? 1 : stepIndex;
    const checkpoint = assetForStep(chapterAssets, assetStepIndex);
    const hasStepImage = assetStepIndex in (input.stepImageExtensions ?? {});
    let figureLine = "";
    if (checkpoint?.url?.trim()) {
      figureLine = `<div className="${prefix}-figure-wrap" data-no-advance><img className="${prefix}-figure" src="${escapeTsString(checkpoint.url.trim())}" alt="" /></div>`;
    } else if (hasStepImage) {
      figureLine = `<div className="${prefix}-figure-wrap" data-no-advance><img className="${prefix}-figure" src={stepImageUrl(${assetStepIndex})} alt="" /></div>`;
    }
    return stepSceneBlock(
      stepIndex,
      intro,
      introSub,
      prefix,
      screen,
      narration,
      figureLine,
      dividerKicker,
    );
  });

  const tsx = `import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

${stepImageBlock}
const STEP_MOTIONS = ${JSON.stringify(workMotions, null, 2)} as const;
const CHAPTER_KICKER = ${JSON.stringify(kicker)};

function stepMotion(step: number) {
  return STEP_MOTIONS[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
}

/** CourseFlow · Beat Scene（每步分段 MaskReveal + 內容感知裝飾） */
export default function ${componentName}({ step }: ChapterStepProps) {
  const motion = stepMotion(step);
${scenes.join("\n")}
  return null;
}
`;

  const css = `/* ${componentName} — beat-scene */
.${prefix}-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 100%;
  gap: var(--space-6);
}
.${prefix}-scene:has(.${prefix}-figure-wrap img) {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto minmax(240px, 1fr);
  justify-items: center;
  align-content: center;
  text-align: center;
}
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-main {
  align-items: center;
  text-align: center;
  width: 100%;
}
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-headline {
  max-width: none;
  text-align: center;
}
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-contrast {
  margin-inline: auto;
}
.${prefix}-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4, 1.25rem);
  width: 85%;
  max-width: 85%;
}
.${prefix}-kicker { opacity: 0.72; }
.${prefix}-headline {
  margin: 0;
  font-size: clamp(72px, 8.5vmin, 128px);
  line-height: 1.1;
  width: 100%;
  max-width: 100%;
  text-align: center;
}
.${prefix}-headline-sub { font-style: italic; color: var(--accent, var(--text)); }
.${prefix}-accent-metric { color: var(--accent, var(--text)); }
.${prefix}-contrast {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-4);
  max-width: 28rem;
}
.${prefix}-contrast-left,
.${prefix}-contrast-right {
  height: 0.35rem;
  border-radius: 999px;
  background: var(--accent, currentColor);
  transform-origin: left;
  animation: ${prefix}-grow 1.1s var(--ease-expo, ease-out) both;
}
.${prefix}-contrast-right { animation-delay: 0.35s; opacity: 0.55; }
.${prefix}-metric-num { font-size: clamp(80px, 8vmin, 128px); line-height: 1; }
.${prefix}-pulse-ring {
  display: block;
  width: 4rem;
  height: 4rem;
  border: 2px solid var(--accent, currentColor);
  border-radius: 50%;
  animation: ${prefix}-pulse 2.4s ease-in-out infinite;
}
.${prefix}-figure-wrap { display: flex; align-items: center; justify-content: center; }
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-figure-wrap {
  width: min(100%, 1100px);
  min-height: 480px;
}
.${prefix}-figure { max-width: 100%; max-height: 560px; object-fit: contain; border-radius: var(--r-md); }
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-figure {
  max-height: 600px;
}
@keyframes ${prefix}-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes ${prefix}-pulse {
  0%, 100% { transform: scale(0.92); opacity: 0.45; }
  50% { transform: scale(1.05); opacity: 1; }
}
`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs({ ...input, narrations: workNarrations }),
    narrations: workNarrations,
  };
}
