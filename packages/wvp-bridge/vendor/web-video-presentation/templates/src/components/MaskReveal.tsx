import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePresentationMotion } from "../hooks/usePresentationMotion";

interface Props {
  show: boolean;
  delay?: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}

/**
 * clip-path 文字撦除。Phase 2 改由 Framer Motion 驅動，保留 .mask-reveal 的 bleed 樣式。
 */
export function MaskReveal({
  show,
  delay = 0,
  duration,
  className,
  children,
}: Props) {
  const { reduce, wipe } = usePresentationMotion();
  const dur = (duration ?? 700) / 1000;

  return (
    <motion.span
      className={["mask-reveal", className].filter(Boolean).join(" ")}
      style={{ display: "inline-block" }}
      initial={false}
      animate={{
        clipPath: show
          ? "inset(0 -0.12em 0 0)"
          : reduce
            ? "inset(0 -0.12em 0 0)"
            : "inset(0 100% 0 0)",
        opacity: show ? 1 : reduce ? 1 : 0.01,
      }}
      transition={{
        ...wipe,
        duration: reduce ? 0 : dur,
        delay: show && !reduce ? delay / 1000 : 0,
      }}
    >
      {children}
    </motion.span>
  );
}
