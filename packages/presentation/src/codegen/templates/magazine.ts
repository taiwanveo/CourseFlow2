import { splitNarrationPhrases } from "../../narration-phrases.js";
import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import { assetForStep, assetsForChapter } from "../hook-slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";

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
  return `${t.slice(0, max - 1)}…`;
}

function pickLayout(step: number): "cover" | "split" | "callout" | "figure-first" {
  if (step === 0) return "cover";
  const variants = ["split", "callout", "figure-first", "split"] as const;
  return variants[(step - 1) % variants.length]!;
}

function bodyLines(phrases: string[], headline: string, bodyClass: string): string {
  const rest = phrases.filter((p) => p !== headline).slice(0, 3);
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
  return `<ChapterFigure url={\`\${import.meta.env.BASE_URL}images/${wvpChapterId}/${String(step + 1).padStart(2, "0")}.jpg\`} alt="${alt}" className="${prefix}-figure" />`;
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
  const screenLine = truncate(screenContent, 34);
  const phrases = splitNarrationPhrases(narration, 4);
  const headline = screenLine || truncate(phrases[0] ?? narration, 13) || `步驟 ${step + 1}`;
  const headlineTone =
    headline.length <= 8 ? "headline-short" : headline.length <= 16 ? "headline-mid" : "headline-long";
  const kicker = beat ? truncate(beat, 40) : `Step ${String(step + 1).padStart(2, "0")}`;
  const figure = figureBlock(prefix, wvpChapterId, step, checkpointUrl, figureAlt);
  const bodyBlock = bodyLines(phrases, phrases[0] ?? headline, `${prefix}-body`);

  if (layout === "cover") {
    return `
  if (step === ${step}) {
    return (
      <div className="${prefix}-scene scene-pad asd-no-banner">
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
      <div className="${prefix}-scene scene-pad asd-no-banner">
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
${bodyBlock || `              <p className="${prefix}-body asd-body-line">${escapeTsString(truncate(narration, 160))}</p>`}
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
      <div className="${prefix}-scene scene-pad asd-no-banner ${prefix}-figure-first">
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
${bodyBlock || `              <p className="${prefix}-body asd-body-line">${escapeTsString(truncate(narration, 160))}</p>`}
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
      <div className="${prefix}-scene scene-pad asd-no-banner ${prefix}-close ${prefix}-close-with-figure">
        <div className="${prefix}-close-inner">
          <div className="${prefix}-close-copy">
            <div className="pull-quote ${prefix}-quote">
              <MaskReveal show duration={1100}>
                <span className="serif-cn ${prefix}-${headlineTone}">${escapeTsString(headline)}</span>
              </MaskReveal>
            </div>
            <div className="${prefix}-body">
${bodyBlock || `              <p className="${prefix}-body asd-body-line">${escapeTsString(truncate(narration, 160))}</p>`}
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

  const tsx = `import { MaskReveal } from "../../components/MaskReveal";
${figureImport}import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

export default function ${componentName}({ step }: ChapterStepProps) {
${stepBlocks.join("\n")}
  return null;
}
`;

  const css = `.${prefix}-scene { height: 100%; display: flex; flex-direction: column; text-align: left; }
.${prefix}-cover-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr minmax(320px, 42%);
  gap: var(--space-7);
  align-items: center;
  padding-top: var(--space-5);
}
.${prefix}-cover-h, .${prefix}-split-h, .${prefix}-quote {
  font-size: clamp(2.75rem, 5vw, 5rem);
  line-height: 1.08;
  text-align: center;
  margin: 0;
}
.${prefix}-headline-short {
  font-size: clamp(3.8rem, 6.4vw, 6.2rem);
  letter-spacing: 0.01em;
}
.${prefix}-headline-mid {
  font-size: clamp(3.2rem, 5.6vw, 5.4rem);
}
.${prefix}-headline-long {
  font-size: clamp(2.35rem, 4.6vw, 4.2rem);
}
.${prefix}-cover-num { font-size: clamp(4rem, 8vw, 7rem); margin-bottom: var(--space-4); }
.${prefix}-body { text-align: left; font-size: var(--t-body, 22px); line-height: 1.55; max-width: 52ch; }
.asd-body-line { margin: 0 0 var(--space-3); color: var(--text-2, var(--text)); }
.${prefix}-split {
  flex: 1;
  display: grid;
  grid-template-columns: 1.1fr minmax(360px, 45%);
  gap: var(--space-7);
  align-items: center;
}
.${prefix}-split-text { display: flex; flex-direction: column; gap: var(--space-4); justify-content: center; }
.${prefix}-split-h { text-align: left; }
.${prefix}-split-num { align-self: flex-start; }
.${prefix}-figure-first-grid {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(380px, 48%) 1fr;
  gap: var(--space-7);
  align-items: center;
}
.${prefix}-figure-first-copy { display: flex; flex-direction: column; gap: var(--space-4); }
.${prefix}-close-inner {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr minmax(360px, 44%);
  gap: var(--space-7);
  align-items: center;
}
.${prefix}-close-copy { display: flex; flex-direction: column; gap: var(--space-4); }
.${prefix}-quote { text-align: left; font-size: clamp(2rem, 3.6vw, 3.5rem); }
.${prefix}-figure { align-self: stretch; width: 100%; min-height: min(380px, 40vh); }
.${prefix}-figure img { min-height: min(380px, 40vh); object-fit: cover; }
`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
