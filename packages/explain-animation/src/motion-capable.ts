import type { ExplainAnimationConfig, ExplainPatternId } from "./schema.js";

/** Phase 2/3：可由 WVP 模板內 Framer Motion 元件渲染的 pattern（不再產 iframe HTML） */
export const MOTION_CAPABLE_PATTERNS = [
  "process_flow",
  "stagger_reveal",
  "checklist_ticks",
  "split_contrast",
  "counter_kpi",
  "percent_grow",
  "percent_shrink",
  "journey_a_to_b",
  "value_compare",
  "parts_merge",
  "bars_race",
  "amount_add",
  "funnel_narrow",
  "ratio_split",
  "pulse_highlight",
] as const satisfies readonly ExplainPatternId[];

export type MotionCapablePattern = (typeof MOTION_CAPABLE_PATTERNS)[number];

const MOTION_SET = new Set<string>(MOTION_CAPABLE_PATTERNS);

export function isMotionCapablePattern(pattern: string): pattern is MotionCapablePattern {
  return MOTION_SET.has(pattern);
}

export function isMotionRenderable(config: ExplainAnimationConfig): config is ExplainAnimationConfig & {
  pattern: MotionCapablePattern;
} {
  return isMotionCapablePattern(config.pattern);
}
