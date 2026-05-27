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

function stepScene(
  step: number,
  narration: string,
  title: string,
  prefix: string,
  wvpChapterId: string,
  beat?: string,
  checkpointUrl?: string,
  figureAlt?: string,
): string {
  const layout = step === 0 ? "cover" : step % 2 === 1 ? "split" : "quote";
  const useFigure = layout !== "cover";
  const figureBlock = useFigure
    ? checkpointUrl?.trim()
      ? `<ChapterFigure url="${escapeTsString(checkpointUrl)}" alt="${escapeTsString(figureAlt ?? "")}" className="${prefix}-figure" />`
      : `<ChapterFigure url={\`\${import.meta.env.BASE_URL}images/${wvpChapterId}/${String(step + 1).padStart(2, "0")}.jpg\`} alt="${escapeTsString(figureAlt ?? "")}" className="${prefix}-figure" />`
    : "";
  const phrases = splitNarrationPhrases(narration, 4);
  const headline = phrases[0] ?? (truncate(narration, 48) || `步驟 ${step + 1}`);
  const kicker = beat ? truncate(beat, 40) : `Step ${String(step + 1).padStart(2, "0")}`;
  const phrasesJson = JSON.stringify(phrases.length ? phrases : [headline]);
  if (layout === "cover") {
    return `
  if (step === ${step}) {
    return (
      <div className="${prefix}-scene scene-pad">
        <header className="masthead">
          <span className="brand">${escapeTsString(title)}</span>
          <span className="issue">${escapeTsString(kicker)}</span>
        </header>
        <hr className="rule" style={{ marginTop: "var(--space-5)" }} />
        <div className="${prefix}-cover-body">
          <div className="kicker">CourseFlow WVP</div>
          <h1 className="${prefix}-cover-h">
            <MaskReveal show duration={900}>
              <span className="serif-cn">${escapeTsString(headline)}</span>
            </MaskReveal>
          </h1>
        </div>
      </div>
    );
  }`;
  }

  if (layout === "split") {
    return `
  if (step === ${step}) {
    return (
      <div className="${prefix}-scene scene-pad">
        <header className="masthead">
          <span className="brand">${escapeTsString(title)}</span>
          <span className="issue">${escapeTsString(kicker)}</span>
        </header>
        <hr className="rule" style={{ marginTop: "var(--space-5)" }} />
        <div className="${prefix}-split${figureBlock ? ` ${prefix}-split-with-figure` : ""}">
          <div className="${prefix}-split-num hero-num">${String(step + 1).padStart(2, "0")}</div>
          <div className="${prefix}-split-body">
            <h2 className="${prefix}-split-h">
              <MaskReveal show duration={900}>
                <span className="serif-cn">${escapeTsString(headline)}</span>
              </MaskReveal>
            </h2>
          </div>
          ${figureBlock}
        </div>
      </div>
    );
  }`;
  }

  return `
  if (step === ${step}) {
    return (
      <div className="${prefix}-scene scene-pad ${prefix}-close${figureBlock ? ` ${prefix}-close-with-figure` : ""}">
        <div className="${prefix}-close-inner">
          <div className="pull-quote ${prefix}-quote">
            <MaskReveal show duration={1100}>
              <span className="serif-cn">${escapeTsString(headline)}</span>
            </MaskReveal>
          </div>
          ${figureBlock}
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

  const css = `.${prefix}-scene { height: 100%; display: flex; flex-direction: column; }
.${prefix}-cover-body, .${prefix}-split, .${prefix}-close-inner { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.${prefix}-cover-h, .${prefix}-split-h, .${prefix}-quote { font-size: clamp(2.5rem, 4vw, 4.5rem); line-height: 1.1; }
.${prefix}-split { display: grid; grid-template-columns: minmax(120px, 1fr) 2fr; gap: var(--space-6); align-items: center; }
.${prefix}-split-with-figure { grid-template-columns: minmax(80px, 0.6fr) 1.4fr minmax(200px, 0.9fr); }
.${prefix}-close-with-figure .${prefix}-close-inner { display: grid; grid-template-columns: 1.2fr minmax(200px, 0.8fr); gap: var(--space-6); align-items: center; }
.${prefix}-figure { align-self: stretch; justify-self: end; max-width: min(480px, 42vw); width: 100%; }
.${prefix}-figure img { min-height: 240px; }
`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
