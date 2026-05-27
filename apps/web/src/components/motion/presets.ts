"use client";

import { useReducedMotion, type Transition, type Variants } from "framer-motion";

export function useUiMotion() {
  const reduce = useReducedMotion();

  const transition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

  const fadeSlide: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 8 },
    show: { opacity: 1, y: 0, transition },
    exit: { opacity: 0, y: reduce ? 0 : -6, transition },
  };

  const pop: Variants = {
    hidden: { opacity: 0, scale: reduce ? 1 : 0.98 },
    show: { opacity: 1, scale: 1, transition },
    exit: { opacity: 0, scale: reduce ? 1 : 0.98, transition },
  };

  const listItem: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 10, height: "auto" },
    show: { opacity: 1, y: 0, height: "auto", transition },
    exit: { opacity: 0, y: reduce ? 0 : -10, height: 0, transition },
  };

  return { reduce, transition, fadeSlide, pop, listItem };
}

