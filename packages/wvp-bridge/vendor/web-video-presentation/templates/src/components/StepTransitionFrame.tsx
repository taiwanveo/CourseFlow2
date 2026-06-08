import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePresentationMotion } from "../hooks/usePresentationMotion";
import { stepTransitionVariants } from "./motion-presets";

/**
 * 步進器消費 transitionId：相鄰步驟切換時套用進出場轉場。
 * 對應 StepDSL enter.transitionId 與場景 data-cf-transition。
 */
export function StepTransitionFrame({
  stepKey,
  transitionId = "crossfade",
  children,
}: {
  stepKey: number | string;
  transitionId?: string;
  children: ReactNode;
}) {
  const { reduce, springReveal } = usePresentationMotion();
  const variants = stepTransitionVariants[transitionId] ?? stepTransitionVariants.crossfade;

  if (transitionId === "none" || reduce) {
    return <div className="step-transition-frame">{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        className="step-transition-frame"
        data-cf-transition={transitionId}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={springReveal}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
