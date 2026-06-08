import { z } from "zod";

/** 單步版面（per-step 模式） */
export const STEP_LAYOUT_IDS = [
  "center-title",
  "visual-focus",
  "explain-focus",
  /** 螢幕文案左欄 + 圖表／視覺右欄（Visual-Mix 協同） */
  "split-focus",
  /** 圖表與解說動畫並列（複合版面） */
  "visual-explain-composite",
  /** Beat-Scene：全屏標題 + 內容感知裝飾（對比條／大數字／脈衝圓） */
  "beat-scene",
] as const;

export type StepLayoutId = (typeof STEP_LAYOUT_IDS)[number];

export const CHAPTER_LAYOUT_IDS = [
  "per-step",
  "list-reveal",
  "flow",
  "hook",
] as const;

export type ChapterLayoutId = (typeof CHAPTER_LAYOUT_IDS)[number];

export const StepEnterSchema = z.object({
  enterAnimationId: z.string().default("fade-up"),
  transitionId: z.string().default("crossfade"),
});

export const StepScreenSchema = z.object({
  headline: z.string(),
  sub: z.string().optional(),
  /** Beat-Scene 分隔頁小標（合併分隔＋單步時使用） */
  kicker: z.string().optional(),
});

/** 執行期由 VisualBlock 消費；建置期由 visual-config 驗證 */
export const VisualConfigLooseSchema = z.record(z.string(), z.unknown());

/** 執行期由 ExplainMotionScene 消費；建置期由 explain-animation 驗證 */
export const ExplainConfigLooseSchema = z.object({
  version: z.number().optional(),
  pattern: z.string(),
  params: z.record(z.unknown()),
});

export const HookSlideSchema = z.object({
  url: z.string().nullable(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  label: z.string().optional(),
});

export const ListRevealItemSchema = z.object({
  num: z.string(),
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().optional(),
  imageStep: z.number().int().min(0).optional(),
  animationHtml: z.string().optional(),
  animationConfig: z.record(z.unknown()).optional(),
  animationStep: z.number().int().min(0).optional(),
});

export const FlowNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
});

export const StepDslStepSchema = z.object({
  step: z.number().int().min(0),
  layout: z.enum(STEP_LAYOUT_IDS),
  screen: StepScreenSchema,
  enter: StepEnterSchema,
  visual: VisualConfigLooseSchema.optional(),
  explain: ExplainConfigLooseSchema.optional(),
  animationHtml: z.string().optional(),
  animationStep: z.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
  imageStep: z.number().int().min(0).optional(),
  /** 口播原文（僅供 Beat-Scene accent 偵測，不顯示於畫面） */
  narration: z.string().optional(),
  /** 螢幕原文（Beat-Scene accent 偵測） */
  screenRaw: z.string().optional(),
});

export const ListBundleSchema = z.object({
  introTitle: z.string(),
  introSub: z.string(),
  items: z.array(ListRevealItemSchema).min(1),
  introImageUrl: z.string().optional(),
  introImageStep: z.number().int().min(0).optional(),
  introAnimationHtml: z.string().optional(),
  introAnimationConfig: z.record(z.unknown()).optional(),
  introAnimationStep: z.number().int().min(0).optional(),
});

export const FlowBundleSchema = z.object({
  intro: z.string(),
  introSub: z.string(),
  nodes: z.array(FlowNodeSchema).min(1),
});

export const HookBundleSchema = z.object({
  introKicker: z.string(),
  slides: z.array(HookSlideSchema).min(1),
  takeoverTitle: z.string(),
  closeLine: z.string(),
  includeClose: z.boolean(),
});

export const StepDslChapterSchema = z.object({
  version: z.literal(1),
  templateKind: z.enum([
    "hook",
    "list-reveal",
    "flow",
    "visual-mix",
    "beat-scene",
    "magazine",
  ]),
  chapterLayout: z.enum(CHAPTER_LAYOUT_IDS),
  kicker: z.string(),
  steps: z.array(StepDslStepSchema).min(1),
  listBundle: ListBundleSchema.optional(),
  flowBundle: FlowBundleSchema.optional(),
  hookBundle: HookBundleSchema.optional(),
});

export type StepEnter = z.infer<typeof StepEnterSchema>;
export type StepScreen = z.infer<typeof StepScreenSchema>;
export type StepDslStep = z.infer<typeof StepDslStepSchema>;
export type StepDslChapter = z.infer<typeof StepDslChapterSchema>;

export function safeParseStepDslChapter(raw: unknown): StepDslChapter | null {
  const parsed = StepDslChapterSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
