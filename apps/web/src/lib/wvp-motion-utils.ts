/**
 * wvp-motion-utils.ts
 *
 * 工具函式：依章節內容與版型，為每步挑選 enterAnimationId。
 */

import {
  makeContentAwareStepMotions,
  type StepMotion,
} from "@courseflow/presentation";
import type { WvpChapterKind } from "@courseflow/core";
import type { ChapterMotionOrientation } from "@courseflow/explain-animation";
import type { EnterMotionStyle } from "@/lib/wvp-settings";
import { TRANSITION_CYCLE } from "@/lib/wvp-chapter-transitions";

export type { StepMotion };
export {
  STEP_TRANSITION_IDS,
  STEP_TRANSITION_LABELS,
  defaultChapterTransitions,
  isStepTransitionId,
  resolveChapterTransitions,
  type StepTransitionId,
} from "@/lib/wvp-chapter-transitions";
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

/**
 * 根據步驟索引選擇入場動畫。
 * step 0 固定 INTRO_ANIM；其餘從 ENTER_ANIM_CYCLE 循環。
 */
export function pickEnterAnimation(stepIndex: number): string {
  if (stepIndex === 0) return INTRO_ANIM;
  const cycleIndex = (stepIndex - 1) % ENTER_ANIM_CYCLE.length;
  return ENTER_ANIM_CYCLE[cycleIndex] ?? "fade-up";
}

const CONSERVATIVE_ENTERS = ["fade-up", "fade-in", "rise-soft"] as const;
const DRAMATIC_ENTERS = [
  "wipe-up",
  "blur-in",
  "drop-in",
  "scale-in",
  "overshoot",
  "slide-left",
  "slide-right",
] as const;

/** 全專案進場風格：調整 enterAnimationId／transitionId */
export function applyEnterMotionStyle(
  motions: StepMotion[],
  style: EnterMotionStyle | undefined,
): StepMotion[] {
  if (!style || style === "standard") return motions;
  if (style === "conservative") {
    return motions.map((m, i) => ({
      enterAnimationId: i === 0 ? INTRO_ANIM : (CONSERVATIVE_ENTERS[i % CONSERVATIVE_ENTERS.length] ?? "fade-up"),
      transitionId: "crossfade",
    }));
  }
  return motions.map((m, i) => ({
    enterAnimationId:
      i === 0 ? INTRO_ANIM : (DRAMATIC_ENTERS[i % DRAMATIC_ENTERS.length] ?? m.enterAnimationId),
    transitionId: i % 3 === 0 ? "wipe-up" : (m.transitionId ?? "crossfade"),
  }));
}

/** 章節極簡取向：弱化進場動效 */
export function applyChapterMotionOrientationToEnters(
  motions: StepMotion[],
  orientation: ChapterMotionOrientation | undefined,
): StepMotion[] {
  if (orientation !== "minimal") return motions;
  return motions.map((m, i) => ({
    enterAnimationId: i === 0 ? INTRO_ANIM : "fade-up",
    transitionId: "crossfade",
  }));
}

/** 內容感知：依口播／畫面文字與 chapterKind 挑選動畫 */
export function makeDefaultStepMotions(
  stepCount: number,
  opts?: {
    narrations?: string[];
    screenContents?: string[];
    chapterKind?: WvpChapterKind;
    enterMotionStyle?: EnterMotionStyle;
    motionOrientation?: ChapterMotionOrientation;
  },
): StepMotion[] {
  let motions: StepMotion[];
  if (opts?.narrations?.length && opts.chapterKind) {
    motions = makeContentAwareStepMotions(
      opts.narrations,
      opts.screenContents ?? [],
      opts.chapterKind,
    );
  } else {
    motions = Array.from({ length: stepCount }, (_, i): StepMotion => {
      const transitionCycleIndex = i % TRANSITION_CYCLE.length;
      return {
        enterAnimationId: pickEnterAnimation(i),
        transitionId: TRANSITION_CYCLE[transitionCycleIndex] ?? "crossfade",
      };
    });
  }
  motions = applyChapterMotionOrientationToEnters(motions, opts?.motionOrientation);
  return applyEnterMotionStyle(motions, opts?.enterMotionStyle);
}
