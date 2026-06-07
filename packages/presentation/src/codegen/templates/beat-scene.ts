import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import { splitHeadlineForStaggeredReveal } from "../content-aware.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { assetForStep, assetsForChapter } from "../hook-slots.js";
import { screenTextOnly, stripCraftMetadataFromScreen } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * Beat Scene 版型：每步獨立全屏，主標分段 MaskReveal + 內容感知裝飾（類 demo 解說節拍）。
 * 作為 magazine 的強化替代，用於 2+ 步且未命中 list-reveal/flow 的章節。
 */
function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sanitizeBeatScreen(screen: string): string {
  return stripCraftMetadataFromScreen(screen)
    .replace(/\s*[（(](?:Beat-Scene|節拍全屏|Visual-Mix|視覺混合|Magazine|雜誌)[^）)]*[）)]\s*/gi, "")
    .trim();
}

function cssPrefix(wvpChapterId: string): string {
  return `ch-${wvpChapterId.replace(/[^a-z0-9-]/gi, "-")}`;
}

type BeatHeadlineTone = "hero" | "md" | "lg" | "xl" | "compact";

/** 依螢幕標題總字數自適應字級，不截斷文字 */
function beatHeadlineTone(intro: string, introSub: string): BeatHeadlineTone {
  const len = `${intro}${introSub}`.replace(/\s+/g, "").length;
  if (len <= 12) return "hero";
  if (len <= 20) return "md";
  if (len <= 32) return "lg";
  if (len <= 48) return "xl";
  return "compact";
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
  headlineTone: BeatHeadlineTone,
  kickerLabel?: string,
): string {
  const kickerLine = kickerLabel
    ? escapeTsString(kickerLabel)
    : "{CHAPTER_KICKER}";
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
          <div className="${prefix}-kicker label-mono">${kickerLine}</div>
          <h1 className={\`${prefix}-headline serif-cn ${prefix}-headline--${headlineTone}\`}>
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
    const screen = sanitizeBeatScreen(workScreens[stepIndex] ?? "");
    const headline = screenTextOnly(screen, "重點");
    const hasScreen = Boolean(screen.trim());
    const parts = hasScreen ? splitHeadlineForStaggeredReveal(headline, 2) : [];
    const intro = parts[0] ?? headline;
    const introSub = parts[1] ?? "";
    const headlineTone = beatHeadlineTone(intro, introSub);
    const assetStepIndex = isDividerPlusOne ? 1 : stepIndex;
    const checkpoint = assetForStep(chapterAssets, assetStepIndex);
    const hasStepImage = assetStepIndex in (input.stepImageExtensions ?? {});
    let figureLine = "";
    if (checkpoint?.url?.trim()) {
      figureLine = `<div className="${prefix}-figure-wrap" data-no-advance><img className="${prefix}-figure" src="${escapeTsString(checkpoint.url.trim())}" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /></div>`;
    } else if (hasStepImage) {
      figureLine = `<div className="${prefix}-figure-wrap" data-no-advance><img className="${prefix}-figure" src={stepImageUrl(${assetStepIndex})} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /></div>`;
    }
    return stepSceneBlock(
      stepIndex,
      intro,
      introSub,
      prefix,
      screen,
      narration,
      figureLine,
      headlineTone,
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

  const css = `/* ${componentName} — beat-scene · 1920×1080 舞台 token */
.${prefix}-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
  height: 100%;
  max-height: var(--stage-safe-h);
  gap: var(--space-5);
  overflow: hidden;
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
  width: 100%;
  max-width: var(--stage-viz-max-w);
  overflow: visible;
  flex-shrink: 0;
}
.${prefix}-kicker { opacity: 0.72; max-width: 100%; overflow-wrap: anywhere; }
.${prefix}-headline {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2em;
  font-size: var(--t-h1, clamp(80px, 6.5vw, 120px));
  line-height: 1.08;
  width: 100%;
  max-width: var(--stage-viz-max-w);
  text-align: center;
  overflow: visible;
  overflow-wrap: anywhere;
  word-break: keep-all;
  text-wrap: balance;
}
.${prefix}-headline--hero {
  font-size: var(--t-h1, clamp(80px, 6.5vw, 120px));
}
.${prefix}-headline--md {
  font-size: var(--t-h2, clamp(64px, 5.4vw, 96px));
  line-height: 1.1;
}
.${prefix}-headline--lg {
  font-size: clamp(56px, 4.6vw, 80px);
  line-height: 1.12;
}
.${prefix}-headline--xl {
  font-size: clamp(44px, 3.8vw, 64px);
  line-height: 1.14;
}
.${prefix}-headline--compact {
  font-size: clamp(36px, 3vw, 52px);
  line-height: 1.16;
}
.${prefix}-headline .mask-reveal {
  max-width: 100%;
  overflow: visible;
}
.${prefix}-headline span {
  display: inline-block;
  max-width: 100%;
}
.${prefix}-headline-sub {
  display: block;
  font-size: 0.72em;
  line-height: 1.15;
  font-style: italic;
  color: var(--accent, var(--text));
  max-width: 100%;
  overflow: visible;
  overflow-wrap: anywhere;
}
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
.${prefix}-metric-num { font-size: 152px; line-height: 1; }
.${prefix}-pulse-ring {
  display: block;
  width: 4rem;
  height: 4rem;
  border: 2px solid var(--accent, currentColor);
  border-radius: 50%;
  animation: ${prefix}-pulse 2.4s ease-in-out infinite;
}
.${prefix}-figure-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-inline: auto;
  width: min(100%, var(--stage-viz-max-w));
}
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-figure-wrap {
  width: 100%;
  max-width: var(--stage-viz-max-w);
  min-height: 0;
  max-height: var(--stage-figure-h);
  flex: 1;
}
.${prefix}-figure { max-width: 100%; max-height: var(--stage-figure-h); object-fit: contain; border-radius: var(--r-md); }
.${prefix}-scene:has(.${prefix}-figure-wrap img) .${prefix}-figure {
  max-height: var(--stage-figure-h);
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
