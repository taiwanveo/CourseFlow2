/** 是否含與口播綁定的視覺演示（概念圖解／清單／流程） */
export function hasVisualDemoInSources(tsx: string, css: string): boolean {
  const blob = `${tsx}\n${css}`;
  if (/ListRevealGrid|FlowDiagram|HookImageStrip|VisualBlock|vf-chart|hk-solo-frame|cf-flow-svg|lr-slot-active/i.test(blob)) return true;
  if (/ChapterFigure|hero-num|MaskReveal\s+show/i.test(blob)) return true;
  if (/NarrationBeat|cf-narration-beat/i.test(blob)) return true;
  if (/<svg|<canvas/i.test(blob)) return true;
  if (/@keyframes|animation:\s*[^n]/i.test(css)) return true;
  if (/stroke-dasharray|viewBox=|\.getContext\(/i.test(blob)) return true;
  if (/StepContentViz|cf-content-viz/i.test(blob)) return false;
  return false;
}

export function chapterBindsNarrationText(tsx: string, narrations: string[]): boolean {
  if (narrations.length === 0) return false;

  // 口播句只存在 narrations.ts，不應出現在元件 TSX 裡。
  // 此函式改為驗證「元件有正確數量的 step 分支」——確保每步口播都有對應畫面。
  const stepBranches = tsx.match(/if\s*\(\s*step\s*===\s*\d+\s*\)/g)?.length ?? 0;
  if (stepBranches >= narrations.length) return true;

  // ListRevealGrid / FlowDiagram 以 step prop 驅動，不需要 if(step===N) 分支
  if (/ListRevealGrid|FlowDiagram|HookImageStrip/.test(tsx)) return true;

  // VisualBlock：有 STEP_VISUALS 結構，逐步索引視為已綁定
  if (/VisualBlock/.test(tsx) && /STEP_VISUALS/.test(tsx)) {
    return narrations.every(
      (_, i) => tsx.includes(`step === ${i}`) || tsx.includes(`step={${i}}`),
    );
  }

  return false;
}

export function chapterUsesInvalidMaskReveal(tsx: string): boolean {
  if (/ListRevealGrid|FlowDiagram|HookImageStrip/.test(tsx)) return false;
  // 純手寫 CSS/SVG 動畫不含 MaskReveal → 視為合法，不算「用錯"
  if (!/MaskReveal/.test(tsx)) return false;
  return /MaskReveal\s+title=/.test(tsx) || !/MaskReveal\s+show/.test(tsx);
}

export function needsChapterContentUpgrade(
  tsx: string,
  css: string,
  narrations: string[],
): boolean {
  if (/StepContentViz/.test(tsx)) return true;
  if (/ListRevealGrid/.test(tsx) && !/imageUrl|lr-featured-img/.test(tsx)) return true;
  if (/FlowDiagram/.test(tsx) && !/stepImageUrl/.test(tsx)) return true;
  if (chapterUsesInvalidMaskReveal(tsx) && !/ListRevealGrid|FlowDiagram|HookImageStrip|VisualBlock/.test(tsx)) {
    return true;
  }
  if (!hasVisualDemoInSources(tsx, css)) return true;
  if (!chapterBindsNarrationText(tsx, narrations)) return true;
  return false;
}
