import type { Transition, Variants } from "framer-motion";

/** 與 tokens.css --ease-quart 相近的緩動曲線 */
export const easeQuart = [0.25, 1, 0.5, 1] as const;

export const springReveal: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 32,
  mass: 0.85,
};

export const springFlow: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.9,
};

export const flowConnectorTransition: Transition = {
  duration: 0.9,
  ease: easeQuart,
};

/** 步間轉場時長（transitionId → 秒） */
export const stepTransitionTiming: Record<
  string,
  { duration: number; ease?: typeof easeQuart }
> = {
  crossfade: { duration: 0.42, ease: easeQuart },
  fade: { duration: 0.38, ease: easeQuart },
  wipe: { duration: 0.68, ease: easeQuart },
  "slide-left": { duration: 0.52, ease: easeQuart },
  "slide-right": { duration: 0.52, ease: easeQuart },
  none: { duration: 0 },
};

/** ListRevealGrid：清單格 stagger 進場（章節引子 ghost 預覽） */
export const listStaggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.32,
    },
  },
};

/** 依 usePresentationMotion.stagger 產生編排用 stagger 容器 */
export function listStaggerContainerWith(stagger: number, delayChildren = 0.32): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: stagger,
        delayChildren: stagger > 0 ? delayChildren : 0,
      },
    },
  };
}

/** 複合版面內文／圖表編排 */
export const compositePanelVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ...springReveal, staggerChildren: 0.07 },
  },
};

export const compositePanelChildVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springReveal },
};

/** ListRevealGrid：引子頁 ghost 槽位初次登場 */
export const listSlotIntroVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: {
    opacity: 0.55,
    y: 0,
    scale: 1,
    transition: springReveal,
  },
};

/** ListRevealGrid：ghost / active / past 狀態切換 */
export const listSlotVariants: Variants = {
  ghost: {
    opacity: 0.55,
    scale: 0.96,
    y: 0,
    transition: springReveal,
  },
  past: {
    opacity: 0.72,
    scale: 0.98,
    y: 0,
    transition: springReveal,
  },
  active: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springReveal,
  },
};

/** ListRevealGrid：active 槽位內文揭示 */
export const listSlotContentVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      ...springReveal,
      staggerChildren: 0.06,
    },
  },
};

export const listSlotLineVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: springReveal },
};

/** FlowDiagram：節點 pending / on / done 高亮 */
export const flowCardVariants: Variants = {
  pending: {
    opacity: 0.45,
    scale: 0.96,
    y: 4,
    transition: springFlow,
  },
  on: {
    opacity: 1,
    scale: 1,
    y: -2,
    transition: springFlow,
  },
  done: {
    opacity: 0.94,
    scale: 0.99,
    y: 0,
    transition: springFlow,
  },
};

/** HookImageStrip：ghost 格 / mini 縮圖 stagger */
export const hookStaggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.12,
    },
  },
};

export const hookGhostVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: springReveal },
};

export const hookMiniVariants: Variants = {
  hidden: { opacity: 0, scale: 2.2 },
  show: { opacity: 1, scale: 1, transition: springReveal },
};

export const hookSoloVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: springReveal },
};

/** VisualBlock / 標題進場 */
export const sceneHeadlineVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: springReveal },
};

export const sceneBodyVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ...springReveal, staggerChildren: 0.06 },
  },
};

/** TableRenderer / AnimationRenderer 列進場 */
export const tableRowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: springReveal },
};

export const animItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: springReveal },
};

/** StepDSL center-title / visual 進場（對應 enterAnimationId） */
export const enterMotionVariants: Record<string, Variants> = {
  "fade-up": {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: springReveal },
  },
  "fade-in": {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: springReveal },
  },
  "slide-left": {
    hidden: { opacity: 0, x: -28 },
    show: { opacity: 1, x: 0, transition: springReveal },
  },
  "slide-right": {
    hidden: { opacity: 0, x: 28 },
    show: { opacity: 1, x: 0, transition: springReveal },
  },
  "scale-in": {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1, transition: springReveal },
  },
  "drop-in": {
    hidden: { opacity: 0, y: -24 },
    show: { opacity: 1, y: 0, transition: springReveal },
  },
  "wipe-up": {
    hidden: { opacity: 0, y: 32 },
    show: { opacity: 1, y: 0, transition: springReveal },
  },
  "rise-soft": {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { ...springReveal, stiffness: 280 } },
  },
  "blur-in": {
    hidden: { opacity: 0, filter: "blur(8px)" },
    show: { opacity: 1, filter: "blur(0px)", transition: springReveal },
  },
};

/** 步與步之間轉場（StepDSL transitionId → 步進器） */
export const stepTransitionVariants: Record<string, Variants> = {
  crossfade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  wipe: {
    initial: { opacity: 0, y: 28, clipPath: "inset(100% 0 0 0)" },
    animate: { opacity: 1, y: 0, clipPath: "inset(0 0 0 0)" },
    exit: { opacity: 0, y: -18, clipPath: "inset(0 0 100% 0)" },
  },
  "slide-left": {
    initial: { opacity: 0, x: 48 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -36 },
  },
  "slide-right": {
    initial: { opacity: 0, x: -48 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 36 },
  },
  none: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
  },
};
