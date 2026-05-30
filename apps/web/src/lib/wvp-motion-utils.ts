/**
 * wvp-motion-utils.ts
 *
 * 工具函式：為每個步驟自動分配多樣的 enterAnimationId，
 * 讓每章的入場動畫不再全是 fade-up，而是依索引循環使用
 * 所有已定義的 cf-enter-* 類型。
 */

export type StepMotion = {
  enterAnimationId: string;
  transitionId: string;
};

/**
 * 完整的 cf-enter-* 動畫循環序列。
 * 順序經過設計：視覺節奏有起伏，避免連續相似方向。
 * index 0（章節引子）固定使用 "scale-in"（震撼感）。
 */
const ENTER_ANIM_CYCLE: string[] = [
  "fade-up",      // 1 — 基本向上淡入，乾淨
  "slide-left",   // 2 — 從左滑入，方向感
  "blur-in",      // 3 — 毛玻璃淡入，神秘感
  "slide-right",  // 4 — 從右滑入，方向反轉
  "wipe-up",      // 5 — clip-path 揭幕，戲劇性
  "drop-in",      // 6 — 從上方落下，節奏變化
  "scale-in",     // 7 — 縮放入場，強調
  "overshoot",    // 8 — 彈性縮放，活潑
  "rise-soft",    // 9 — 微幅上升，沉穩
];

/** step 0（章節引子頁）固定使用的動畫 */
const INTRO_ANIM = "scale-in";

/** transitionId 循環 — 轉場類型多樣化 */
const TRANSITION_CYCLE: string[] = [
  "crossfade",
  "crossfade",
  "crossfade",
  "crossfade",
  "crossfade",
  "crossfade",
  "crossfade",
  "crossfade",
  "crossfade",
];

/**
 * 根據步驟索引選擇入場動畫。
 * step 0 固定 INTRO_ANIM；其餘從 ENTER_ANIM_CYCLE 循環。
 */
export function pickEnterAnimation(stepIndex: number): string {
  if (stepIndex === 0) return INTRO_ANIM;
  const cycleIndex = (stepIndex - 1) % ENTER_ANIM_CYCLE.length;
  return ENTER_ANIM_CYCLE[cycleIndex] ?? "fade-up";
}

/**
 * 為整章產出完整的 stepMotions 陣列。
 * 可直接傳入 generateChapterSources / writeChapterToPresentation 的 stepMotions 欄位。
 */
export function makeDefaultStepMotions(stepCount: number): StepMotion[] {
  return Array.from({ length: stepCount }, (_, i): StepMotion => {
    const transitionCycleIndex = i % TRANSITION_CYCLE.length;
    return {
      enterAnimationId: pickEnterAnimation(i),
      transitionId: TRANSITION_CYCLE[transitionCycleIndex] ?? "crossfade",
    };
  });
}
