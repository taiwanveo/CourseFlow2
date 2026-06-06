import { splitNarrationPhrases } from "../../narration-phrases.js";
import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { assetForStep, assetsForChapter } from "../hook-slots.js";
import { screenTextOnly } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * Magazine / editorial 章節版型 codegen。
 *
 * 跟 list-reveal / flow / hook 不同，magazine 有大量樣式直接內嵌在這個檔案回傳的 CSS 字串中。
 * 所以未來若你要調整標題大小、split 比例、章節 divider 位置，這個檔案本身就是主要修改點。
 */
function escapeTsString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function cssPrefix(wvpChapterId: string): string {
  return `ch-${wvpChapterId.replace(/[^a-z0-9-]/gi, "-")}`;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

/** 決定每一步輪替使用哪種 editorial 版面。若想固定某種節奏，可直接改這裡。 */
function pickLayout(step: number): "cover" | "split" | "callout" | "figure-first" {
  if (step === 0) return "cover";
  const variants = ["split", "callout", "figure-first", "split"] as const;
  return variants[(step - 1) % variants.length]!;
}

function bodyLines(phrases: string[], headline: string, bodyClass: string): string {
  const normalizedHeadline = headline.replace(/\s+/g, "");
  const rest = phrases
    .filter((p) => {
      const t = p.trim();
      if (!t) return false;
      const normalized = t.replace(/\s+/g, "");
      return (
        normalized !== normalizedHeadline &&
        !normalized.includes(normalizedHeadline) &&
        !normalizedHeadline.includes(normalized)
      );
    })
    .slice(0, 3);
  if (rest.length === 0) return "";
  return rest
    .map(
      (line) =>
        `              <p className="${bodyClass} asd-body-line">${escapeTsString(truncate(line, 120))}</p>`,
    )
    .join("\n");
}

function figureBlock(
  prefix: string,
  wvpChapterId: string,
  step: number,
  checkpointUrl?: string,
  figureAlt?: string,
): string {
  const alt = escapeTsString(figureAlt ?? "");
  if (checkpointUrl?.trim()) {
    return `<ChapterFigure url="${escapeTsString(checkpointUrl)}" alt="${alt}" className="${prefix}-figure" />`;
  }
  return `<ChapterFigure url={stepImageUrl(${step})} alt="${alt}" className="${prefix}-figure" optional />`;
}

function chapterDividerScene(
  narration: string,
  screenContent: string,
  title: string,
  prefix: string,
  wvpChapterId: string,
  checkpointUrl?: string,
  figureAlt?: string,
): string {
  const headline = screenTextOnly(screenContent, title || "章節");
  const figureUrl = checkpointUrl?.trim()
    ? `"${escapeTsString(checkpointUrl.trim())}"`
    : `{stepImageUrl(0)}`;
  const alt = escapeTsString(figureAlt ?? headline);
  return `
  if (step === 0) {
    return (
      <div className={\`${prefix}-scene ${prefix}-chapter-divider scene-pad cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <h1 className={\`${prefix}-divider-title serif-cn\`}>
          <MaskReveal show duration={900}>
            <span>${escapeTsString(headline)}</span>
          </MaskReveal>
        </h1>
        <ChapterFigure url={${figureUrl}} alt="${alt}" className="${prefix}-divider-figure" optional />
      </div>
    );
  }`;
}

function stepScene(
  step: number,
  narration: string,
  screenContent: string,
  title: string,
  prefix: string,
  wvpChapterId: string,
  beat?: string,
  checkpointUrl?: string,
  figureAlt?: string,
): string {
  const layout = pickLayout(step);
  const phrases = splitNarrationPhrases(narration, 4);
  const headline = screenTextOnly(screenContent, `步驟 ${step + 1}`);
  const headlineTone =
    headline.length <= 8 ? "headline-short" : headline.length <= 16 ? "headline-mid" : "headline-long";
  const stepLabel = `Step ${String(step + 1).padStart(2, "0")}`;
  const rawKicker = beat ? truncate(beat, 40) : stepLabel;
  const kicker =
    rawKicker.replace(/\s+/g, "") === headline.replace(/\s+/g, "") ? stepLabel : rawKicker;
  const figure = figureBlock(prefix, wvpChapterId, step, checkpointUrl, figureAlt);
  // 當 screenContent 已明確設定時，口播稿只作為音訊用途，不應出現在畫面上。
  // 只有在沒有 screenContent 時才以口播片語填充 body 區塊（降級模式）。
  const bodyBlock = screenContent.trim()
    ? ""
    : bodyLines(phrases, phrases[0] ?? headline, `${prefix}-body`);
  const narrationFallback = screenContent.trim()
    ? ""
    : `              <p className="${prefix}-body asd-body-line">${escapeTsString(truncate(narration, 160))}</p>`;

  if (layout === "cover") {
    return `
  if (step === ${step}) {
    return (
      <div className={\`${prefix}-scene scene-pad asd-no-banner cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <header className="masthead">
          <span className="brand">${escapeTsString(title)}</span>
          <span className="issue">${escapeTsString(kicker)}</span>
        </header>
        <div className="${prefix}-cover-body">
          <div className="hero-num ${prefix}-cover-num">${String(step + 1).padStart(2, "0")}</div>
          <h1 className="${prefix}-cover-h">
            <MaskReveal show duration={900}>
              <span className="serif-cn ${prefix}-${headlineTone}">${escapeTsString(headline)}</span>
            </MaskReveal>
          </h1>
          <div className="${prefix}-cover-aside">
            ${figure}
          </div>
        </div>
      </div>
    );
  }`;
  }

  if (layout === "split") {
    return `
  if (step === ${step}) {
    return (
      <div className={\`${prefix}-scene scene-pad asd-no-banner cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <header className="masthead">
          <span className="brand">${escapeTsString(title)}</span>
          <span className="issue">${escapeTsString(kicker)}</span>
        </header>
        <div className="${prefix}-split ${prefix}-split-with-figure">
          <div className="${prefix}-split-text">
            <div className="${prefix}-split-num hero-num">${String(step + 1).padStart(2, "0")}</div>
            <h2 className="${prefix}-split-h">
              <MaskReveal show duration={900}>
                <span className="serif-cn ${prefix}-${headlineTone}">${escapeTsString(headline)}</span>
              </MaskReveal>
            </h2>
            <div className="${prefix}-body">
${bodyBlock || narrationFallback}
            </div>
          </div>
          ${figure}
        </div>
      </div>
    );
  }`;
  }

  if (layout === "figure-first") {
    return `
  if (step === ${step}) {
    return (
      <div className={\`${prefix}-scene scene-pad asd-no-banner ${prefix}-figure-first cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <header className="masthead">
          <span className="brand">${escapeTsString(title)}</span>
          <span className="issue">${escapeTsString(kicker)}</span>
        </header>
        <div className="${prefix}-figure-first-grid">
          ${figure}
          <div className="${prefix}-figure-first-copy">
            <div className="hero-num">${String(step + 1).padStart(2, "0")}</div>
            <h2 className="${prefix}-split-h">
              <MaskReveal show duration={900}>
                <span className="serif-cn ${prefix}-${headlineTone}">${escapeTsString(headline)}</span>
              </MaskReveal>
            </h2>
            <div className="${prefix}-body">
${bodyBlock || narrationFallback}
            </div>
          </div>
        </div>
      </div>
    );
  }`;
  }

  return `
  if (step === ${step}) {
    return (
      <div className={\`${prefix}-scene scene-pad asd-no-banner ${prefix}-close ${prefix}-close-with-figure cf-enter-\${motion.enterAnimationId}\`} data-cf-transition={motion.transitionId}>
        <div className="${prefix}-close-inner">
          <div className="${prefix}-close-copy">
            <div className="pull-quote ${prefix}-quote">
              <MaskReveal show duration={1100}>
                <span className="serif-cn ${prefix}-${headlineTone}">${escapeTsString(headline)}</span>
              </MaskReveal>
            </div>
            <div className="${prefix}-body">
${bodyBlock || narrationFallback}
            </div>
          </div>
          ${figure}
        </div>
      </div>
    );
  }`;
}

export function generateMagazineSources(input: ChapterCodegenInput) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const prefix = cssPrefix(input.wvpChapterId);
  const chapterAssets = assetsForChapter(input.assets, input.wvpChapterId);
  const steps = Math.max(input.narrations.length, 1);
  const beatsByStep = new Map<number, string>();
  for (const b of input.stepBeats ?? []) {
    if (typeof b.step === "number" && b.dominantAction) {
      beatsByStep.set(b.step, b.dominantAction);
    }
  }

  const stepBlocks: string[] = [];
  for (let i = 0; i < steps; i++) {
    if (i === 0) {
      stepBlocks.push(
        chapterDividerScene(
          input.narrations[i] ?? "",
          input.screenContents?.[i] ?? "",
          input.title,
          prefix,
          input.wvpChapterId,
          assetForStep(chapterAssets, i)?.url,
          assetForStep(chapterAssets, i)?.alt,
        ),
      );
      continue;
    }
    stepBlocks.push(
      stepScene(
        i,
        input.narrations[i] ?? "",
        input.screenContents?.[i] ?? "",
        input.title,
        prefix,
        input.wvpChapterId,
        beatsByStep.get(i) ?? input.visualIdeas?.[i % (input.visualIdeas.length || 1)],
        assetForStep(chapterAssets, i)?.url,
        assetForStep(chapterAssets, i)?.alt,
      ),
    );
  }

  const figureImport = `import { ChapterFigure } from "../../components/ChapterFigure";\n`;

  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );

  const tsx = `import { MaskReveal } from "../../components/MaskReveal";
${figureImport}import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

${stepImageBlock}

export default function ${componentName}({ step }: ChapterStepProps) {
  const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;
  const motion = STEP_MOTIONS[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
${stepBlocks.join("\n")}
  return null;
}
`;

  const css = `.${prefix}-scene {
  height: 100%;
  display: flex;
  flex-direction: column;
  text-align: left;
  justify-content: center;
}
.${prefix}-chapter-divider {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-6);
  padding-top: var(--space-8);
  padding-bottom: var(--space-8);
}
.${prefix}-chapter-divider:has(.${prefix}-divider-figure img) {
  justify-content: center;
}
/* 章節 divider 主標題：調這裡可改章首大標字級、行高、最大寬度。 */
.${prefix}-divider-title {
  font-size: clamp(80px, 7vmin, 120px);
  line-height: 1.08;
  margin: 0;
  max-width: 20ch;
  width: 100%;
}
.${prefix}-chapter-divider:has(.${prefix}-divider-figure img) .${prefix}-divider-title {
  font-size: clamp(56px, 5.5vmin, 88px);
  max-width: none;
}
.${prefix}-divider-figure {
  flex: 1;
  width: min(100%, 960px);
  min-height: 280px;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.${prefix}-divider-figure img {
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 520px;
  object-fit: contain;
  border-radius: var(--r-card);
}
.${prefix}-cover-body {
  flex: 1;
  width: 100%;
  max-width: min(1720px, 94%);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(480px, 48%);
  gap: var(--space-8);
  align-items: center;
  padding-top: var(--space-5);
  min-height: min(68vh, 720px);
}
.${prefix}-scene:not(:has(.cf-chapter-figure img)) {
  justify-content: center;
}
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-cover-body,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-split,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-figure-first-grid,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-close-inner {
  grid-template-columns: 1fr;
  justify-items: center;
  align-content: center;
  text-align: center;
  max-width: min(1200px, 92%);
}
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-split-text,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-figure-first-copy,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-close-copy {
  align-items: center;
  text-align: center;
}
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-split-h,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-cover-h,
.${prefix}-scene:not(:has(.cf-chapter-figure img)) .${prefix}-quote {
  text-align: center;
}
/* 有配圖：維持雜誌跨頁雙欄，勿收成置中小卡 */
.${prefix}-scene:has(.cf-chapter-figure img) .${prefix}-cover-body,
.${prefix}-scene:has(.cf-chapter-figure img) .${prefix}-close-inner,
.${prefix}-scene:has(.cf-chapter-figure img) .${prefix}-split-with-figure,
.${prefix}-scene:has(.cf-chapter-figure img) .${prefix}-figure-first-grid {
  width: 100%;
  max-width: min(1720px, 94%);
  margin-inline: auto;
  text-align: left;
  min-height: min(68vh, 720px);
}
.${prefix}-scene:has(.cf-chapter-figure img) .${prefix}-close-inner {
  grid-template-columns: minmax(0, 1fr) minmax(520px, 50%);
}
.${prefix}-scene:has(.cf-chapter-figure img) .${prefix}-cover-body {
  grid-template-columns: minmax(0, 1.05fr) minmax(480px, 48%);
}
/* cover / split / quote 共用主標：這裡是 magazine 版型最常調的標題大小入口。 */
.${prefix}-cover-h, .${prefix}-split-h, .${prefix}-quote {
  font-size: clamp(72px, 6.5vmin, 104px);
  line-height: 1.08;
  text-align: center;
  margin: 0;
}
/* headline 長短分級：標題字數越少，用越大的級距。 */
.${prefix}-headline-short {
  font-size: clamp(88px, 7.5vmin, 112px);
  letter-spacing: 0.01em;
}
.${prefix}-headline-mid {
  font-size: clamp(72px, 6.5vmin, 96px);
}
.${prefix}-headline-long {
  font-size: clamp(56px, 5vmin, 80px);
}
.${prefix}-cover-num { font-size: clamp(96px, 8vmin, 128px); margin-bottom: var(--space-4); }
.${prefix}-cover-aside {
  grid-column: 2;
  grid-row: 1 / -1;
  align-self: center;
  width: 100%;
  min-height: min(56vh, 640px);
}
.${prefix}-cover-body > .${prefix}-cover-num,
.${prefix}-cover-body > .${prefix}-cover-h {
  grid-column: 1;
}
/* 內文段落：調這裡可改 body 字級、行高、單欄最長寬度。 */
.${prefix}-body {
  text-align: left;
  font-size: clamp(28px, 2.4vmin, 36px);
  line-height: 1.55;
  max-width: 40ch;
}
.asd-body-line { margin: 0 0 var(--space-3); color: var(--text-2, var(--text)); }
/* split 版左右欄比例與間距。若要改文字區 / 圖片區寬度，改這裡。 */
.${prefix}-split {
  flex: 1;
  width: 100%;
  max-width: min(1720px, 94%);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(480px, 48%);
  gap: var(--space-8);
  align-items: center;
  min-height: min(68vh, 720px);
}
.${prefix}-split-text { display: flex; flex-direction: column; gap: var(--space-4); justify-content: center; }
.${prefix}-split-h { text-align: left; }
.${prefix}-split-num { align-self: flex-start; }
/* figure-first 版左右欄比例。 */
.${prefix}-figure-first-grid {
  flex: 1;
  width: 100%;
  max-width: min(1720px, 94%);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(480px, 50%) minmax(0, 1fr);
  gap: var(--space-8);
  align-items: center;
  min-height: min(68vh, 720px);
}
.${prefix}-figure-first-copy { display: flex; flex-direction: column; gap: var(--space-4); }
.${prefix}-close-inner {
  flex: 1;
  width: 100%;
  max-width: min(1720px, 94%);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(520px, 50%);
  gap: var(--space-8);
  align-items: center;
  min-height: min(68vh, 720px);
}
.${prefix}-close-copy { display: flex; flex-direction: column; gap: var(--space-4); }
.${prefix}-quote { text-align: left; font-size: clamp(56px, 5vmin, 80px); }
.${prefix}-figure {
  align-self: stretch;
  width: 100%;
  min-height: min(56vh, 640px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.${prefix}-figure .cf-chapter-figure {
  width: 100%;
  max-width: min(920px, 100%);
  min-width: min(560px, 100%);
  min-height: min(54vh, 600px);
  max-height: min(62vh, 680px);
}
.${prefix}-figure img,
.${prefix}-figure .cf-chapter-figure img {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: min(58vh, 640px);
  min-height: min(44vh, 480px);
  object-fit: contain;
}
`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
