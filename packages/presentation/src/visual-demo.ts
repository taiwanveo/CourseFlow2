import { splitNarrationPhrases } from "./narration-phrases.js";

function narrationSnippetInTsx(tsx: string, narration: string): boolean {
  const t = narration.trim();
  if (t.length < 4) return true;

  const phrases = splitNarrationPhrases(t, 4);
  const candidates = new Set<string>();
  for (const len of [12, 10, 8] as const) {
    if (t.length >= 4) candidates.add(t.slice(0, len));
  }
  for (const phrase of phrases) {
    if (phrase.length >= 4) {
      candidates.add(phrase);
      candidates.add(phrase.slice(0, 12));
    }
  }

  for (const snippet of candidates) {
    if (snippet.length >= 4 && tsx.includes(snippet)) return true;
  }
  return false;
}

/** 是否含與口播綁定的視覺演示（概念圖解／清單／流程） */
export function hasVisualDemoInSources(tsx: string, css: string): boolean {
  const blob = `${tsx}\n${css}`;
  if (/ListRevealGrid|FlowDiagram|HookImageStrip|VisualBlock|vf-chart|hk-solo-frame|cf-flow-svg|lr-slot-active/i.test(blob)) return true;
  if (/NarrationBeat|cf-narration-beat/i.test(blob)) return true;
  if (/<svg|<canvas/i.test(blob)) return true;
  if (/@keyframes|animation:\s*[^n]/i.test(css)) return true;
  if (/stroke-dasharray|viewBox=|\.getContext\(/i.test(blob)) return true;
  if (/StepContentViz|cf-content-viz/i.test(blob)) return false;
  return false;
}

export function chapterBindsNarrationText(tsx: string, narrations: string[]): boolean {
  if (narrations.length === 0) return false;

  // VisualBlock：口播在 narrations.ts，畫面以 step 分支 + STEP_VISUALS 對齊
  if (/VisualBlock/.test(tsx) && /STEP_VISUALS/.test(tsx)) {
    return narrations.every(
      (_, i) => tsx.includes(`step === ${i}`) || tsx.includes(`step={${i}}`),
    );
  }

  if (/ListRevealGrid|FlowDiagram|HookImageStrip/.test(tsx)) {
    return narrations.some((n) => narrationSnippetInTsx(tsx, n));
  }

  // Magazine / MaskReveal：畫面用口播拆句後的 headline，未必含原文前 12 字
  return narrations.every((n) => narrationSnippetInTsx(tsx, n));
}

export function chapterUsesInvalidMaskReveal(tsx: string): boolean {
  if (/ListRevealGrid|FlowDiagram|HookImageStrip/.test(tsx)) return false;
  return /MaskReveal\s+title=/.test(tsx) || !/MaskReveal\s+show/.test(tsx);
}

export function needsChapterContentUpgrade(
  tsx: string,
  css: string,
  narrations: string[],
): boolean {
  if (/ListRevealGrid/.test(tsx) && !/imageUrl|lr-featured-img/.test(tsx)) return true;
  if (/FlowDiagram/.test(tsx) && !/stepImageUrl/.test(tsx)) return true;
  if (/ChapterFigure/.test(tsx) && !/import\.meta\.env\.BASE_URL\}images/.test(tsx)) return true;
  if (/StepContentViz/.test(tsx)) return true;
  if (chapterUsesInvalidMaskReveal(tsx)) return true;
  if (!hasVisualDemoInSources(tsx, css)) return true;
  if (!/ListRevealGrid|FlowDiagram|NarrationBeat/.test(tsx)) return true;
  if (!chapterBindsNarrationText(tsx, narrations)) return true;
  return false;
}
