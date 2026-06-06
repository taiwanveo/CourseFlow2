/** 是否含與口播綁定的視覺演示（概念圖解／清單／流程） */
export function hasVisualDemoInSources(tsx: string, css: string): boolean {
  const blob = `${tsx}\n${css}`;
  if (/ListRevealGrid|FlowDiagram|HookImageStrip|VisualBlock|vf-chart|hk-solo-frame|cf-flow-svg|lr-slot-active|bs-scene|bs-contrast|bs-metric/i.test(blob)) return true;
  if (/ChapterFigure|hero-num|MaskReveal\s+show/i.test(blob)) return true;
  if (/NarrationBeat|cf-narration-beat/i.test(blob)) return true;
  if (/<svg|<canvas/i.test(blob)) return true;
  if (/@keyframes|animation:\s*[^n]/i.test(css)) return true;
  if (/stroke-dasharray|viewBox=|\.getContext\(/i.test(blob)) return true;
  if (/StepContentViz|cf-content-viz/i.test(blob)) return false;
  return false;
}

/** 章節是否涵蓋 0..stepCount-1 各步（元件驅動或 if(step===N) 皆可） */
export function chapterCoversAllSteps(tsx: string, stepCount: number): boolean {
  if (stepCount <= 0) return false;
  if (/ListRevealGrid|FlowDiagram|HookImageStrip/.test(tsx)) return true;
  if (/VisualBlock/.test(tsx) && /STEP_VISUALS/.test(tsx)) return true;
  for (let i = 0; i < stepCount; i++) {
    if (!tsx.includes(`step === ${i}`)) return false;
  }
  if (tsx.includes(`step === ${stepCount}`)) return false;
  return true;
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

/** 章節 TSX 是否把口播原文（或首句）寫進畫面常數（例如 ListReveal ITEMS.body） */
export function tsxLeaksNarrationOntoScreen(tsx: string, narrations: string[]): boolean {
  for (const narration of narrations) {
    const text = narration.trim();
    if (text.length < 12) continue;
    if (tsx.includes(text)) return true;
    const firstSentence = text.split(/[。！？.!?]/)[0]?.trim() ?? "";
    if (firstSentence.length >= 8 && tsx.includes(firstSentence)) return true;
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
  // CourseFlow 模板章節（ListReveal / Flow / Hook / VisualBlock）的螢幕文案寫在 TSX 常數裡。
  // 建置前重產時沒有 screenContents 輸入，會退回「本章」「重點 1」占位符，故一律跳過。
  if (/ListRevealGrid|FlowDiagram|HookImageStrip|VisualBlock/.test(tsx)) return false;
  if (chapterUsesInvalidMaskReveal(tsx)) return true;
  if (!hasVisualDemoInSources(tsx, css)) return true;
  if (!chapterBindsNarrationText(tsx, narrations)) return true;
  return false;
}
