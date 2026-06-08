import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePresentationMotion } from "../hooks/usePresentationMotion";
import { enterMotionVariants } from "./motion-presets";

/**
 * StepDSL enterAnimationId 消費者：取代 cf-enter-* CSS，以 Framer Motion variants 進場。
 */
export function StepEnterFrame({
  enterAnimationId = "fade-up",
  className,
  children,
}: {
  enterAnimationId?: string;
  className?: string;
  children: ReactNode;
}) {
  const { reduce, springReveal } = usePresentationMotion();
  const variants =
    enterMotionVariants[enterAnimationId] ?? enterMotionVariants["fade-up"];

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      data-cf-enter={enterAnimationId}
      variants={variants}
      initial="hidden"
      animate="show"
      transition={springReveal}
    >
      {children}
    </motion.div>
  );
}
