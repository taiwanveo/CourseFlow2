export {
  EXPLAIN_PATTERN_IDS,
  ExplainAnimationConfigSchema,
  type ExplainAnimationConfig,
  type ExplainPatternId,
} from "./schema.js";
export { EXPLAIN_PATTERN_REGISTRY, listExplainPatterns, type ExplainPatternMeta } from "./registry.js";
export { inferExplainAnimation, parseChineseInteger, type InferExplainResult } from "./infer.js";
export { renderExplainAnimationHtml, renderScene, type RenderExplainOptions } from "./render/index.js";
export {
  MOTION_CAPABLE_PATTERNS,
  isMotionCapablePattern,
  isMotionRenderable,
  type MotionCapablePattern,
} from "./motion-capable.js";
export {
  CHAPTER_MOTION_ORIENTATION_LABELS,
  ORIENTATION_PATTERN_PRIORITY,
  STEP_MOTION_OVERRIDE_MODE_LABELS,
  STEP_MOTION_PATTERN_GROUPS,
  buildFallbackConfigForPattern,
  parseChapterMotionOrientation,
  parseStepMotionOverride,
  planChapterMotionCoverage,
  readStepMotionOverrideFromEntry,
  resolveExplainForStep,
  stepHasCraftAnimation,
  type ChapterMotionOrientation,
  type ChapterMotionPlan,
  type ExplainResolveKind,
  type ExplainResolveSource,
  type ResolvedExplainStep,
  type StepMotionOverride,
  type StepMotionOverrideMode,
  type StepMotionPlanRow,
} from "./motion-preference.js";
