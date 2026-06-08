import { useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import { easeQuart, springFlow, springReveal } from "../components/motion-presets";

/** 無動效偏好時將 transition 壓成瞬間完成 */
export function motionTransition(reduce: boolean, transition: Transition): Transition {
  return reduce ? { duration: 0 } : transition;
}

/** WVP 舞台元件共用：尊重 prefers-reduced-motion */
export function usePresentationMotion() {
  const reduce = useReducedMotion() ?? false;

  return {
    reduce,
    springReveal: motionTransition(reduce, springReveal),
    springFlow: motionTransition(reduce, springFlow),
    wipe: motionTransition(reduce, { duration: 0.7, ease: easeQuart }),
    wipeFast: motionTransition(reduce, { duration: 0.55, ease: easeQuart }),
    stagger: reduce ? 0 : 0.08,
    staggerRow: reduce ? 0 : 0.055,
  };
}
