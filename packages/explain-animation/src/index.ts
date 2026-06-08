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
