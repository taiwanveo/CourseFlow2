import { z } from "zod";

/** 解說動畫 DSL v1 — 所有 pattern 的參數由啟發式或 LLM 填入，渲染器負責產 HTML */
export const EXPLAIN_PATTERN_IDS = [
  // 數值變化
  "percent_grow",
  "percent_shrink",
  "amount_add",
  "amount_sub",
  "value_compare",
  "counter_kpi",
  "ratio_split",
  "multiplier",
  // 歷程／流程
  "journey_a_to_b",
  "process_flow",
  "funnel_narrow",
  "milestone_path",
  // 平衡／對比
  "balance_seesaw",
  "split_contrast",
  "scale_compare",
  "spectrum_slider",
  // 組合／拆解
  "parts_merge",
  "parts_split",
  "layer_stack",
  "cluster_group",
  // 趨勢迷你圖
  "sparkline_up",
  "bars_race",
  "arc_progress",
  // 強調
  "pulse_highlight",
  "ring_focus",
  "check_complete",
  "badge_unlock",
  // 連結
  "bridge_link",
  "gap_close",
  "network_nodes",
  // 清單
  "stagger_reveal",
  "checklist_ticks",
  "priority_rank",
  // 進階隱喻
  "timeline_year",
  "venn_overlap",
  "before_after_slider",
  "equation_balance",
] as const;

export type ExplainPatternId = (typeof EXPLAIN_PATTERN_IDS)[number];

const percentDelta = z.object({
  beforeValue: z.number(),
  afterValue: z.number(),
  deltaPct: z.number().optional(),
  unit: z.literal("%").default("%"),
  beforeLabel: z.string().default("原本"),
  afterLabel: z.string().default("現在"),
});

const amountDelta = z.object({
  beforeValue: z.number(),
  delta: z.number(),
  afterValue: z.number().optional(),
  unit: z.string().default("萬"),
  entity: z.string().default("B"),
  beforeLabel: z.string().default("原本"),
  afterLabel: z.string().default("現在"),
});

const twoValue = z.object({
  left: z.number(),
  right: z.number(),
  leftLabel: z.string().default("A"),
  rightLabel: z.string().default("B"),
  unit: z.string().default(""),
});

const kpiCounter = z.object({
  target: z.number(),
  unit: z.string().default("%"),
  label: z.string().default(""),
});

const ratio = z.object({
  parts: z.array(z.object({ label: z.string(), value: z.number() })).min(2).max(6),
  unit: z.string().default("%"),
});

const multiplierParams = z.object({
  base: z.number(),
  factor: z.number(),
  result: z.number().optional(),
  unit: z.string().default(""),
});

const journey = z.object({
  fromLabel: z.string().default("A"),
  toLabel: z.string().default("B"),
  viaLabel: z.string().optional(),
});

const flowSteps = z.object({
  steps: z.array(z.string()).min(2).max(6),
});

const funnel = z.object({
  stages: z.array(z.string()).min(2).max(5),
});

const milestones = z.object({
  points: z.array(z.object({ label: z.string(), value: z.string().optional() })).min(2).max(5),
});

const seesaw = z.object({
  leftLabel: z.string(),
  rightLabel: z.string(),
  leftSub: z.string().optional(),
  rightSub: z.string().optional(),
  sequence: z.array(z.enum(["left", "right", "balance"])).default(["left", "right", "balance"]),
});

const splitContrast = z.object({
  leftTitle: z.string(),
  rightTitle: z.string(),
  leftPoints: z.array(z.string()).max(3).default([]),
  rightPoints: z.array(z.string()).max(3).default([]),
});

const scaleCompare = z.object({
  leftWeight: z.number(),
  rightWeight: z.number(),
  leftLabel: z.string(),
  rightLabel: z.string(),
});

const spectrum = z.object({
  leftLabel: z.string(),
  rightLabel: z.string(),
  position: z.number().min(0).max(1).default(0.5),
});

const partsCount = z.object({
  count: z.number().int().min(2).max(8).default(4),
  label: z.string().default(""),
});

const layers = z.object({
  layers: z.array(z.string()).min(2).max(5),
});

const cluster = z.object({
  items: z.array(z.string()).min(3).max(8),
});

const dataPoints = z.object({
  points: z.array(z.object({ label: z.string(), value: z.number() })).min(2).max(8),
  unit: z.string().default(""),
});

const arc = z.object({
  percent: z.number().min(0).max(100),
  label: z.string().default(""),
});

const emphasis = z.object({
  text: z.string().max(12),
  sub: z.string().max(8).optional(),
});

const bridge = z.object({
  leftLabel: z.string().default("起點"),
  rightLabel: z.string().default("終點"),
});

const gap = z.object({
  fromLabel: z.string().default("現況"),
  toLabel: z.string().default("目標"),
  distance: z.number().min(1).max(100).default(60),
});

const network = z.object({
  nodes: z.array(z.string()).min(3).max(6),
  hub: z.string().optional(),
});

const stringList = z.object({
  items: z.array(z.string()).min(2).max(6),
});

const priority = z.object({
  items: z.array(z.object({ label: z.string(), rank: z.number().int() })).min(2).max(5),
});

const timelineYear = z.object({
  years: z.array(z.object({ year: z.number().int(), label: z.string().optional() })).min(2).max(8),
});

const vennOverlap = z.object({
  leftLabel: z.string(),
  rightLabel: z.string(),
  overlapLabel: z.string().optional(),
});

const beforeAfterSlider = z.object({
  beforeLabel: z.string().default("改造前"),
  afterLabel: z.string().default("改造後"),
  sliderPosition: z.number().min(0).max(1).default(0.5),
});

const equationBalance = z.object({
  leftExpr: z.string().max(12),
  rightExpr: z.string().max(12),
  balanced: z.boolean().default(true),
});

export const ExplainAnimationConfigSchema = z.discriminatedUnion("pattern", [
  z.object({ version: z.literal(1).default(1), pattern: z.literal("percent_grow"), params: percentDelta }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("percent_shrink"), params: percentDelta }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("amount_add"), params: amountDelta }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("amount_sub"), params: amountDelta }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("value_compare"), params: twoValue }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("counter_kpi"), params: kpiCounter }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("ratio_split"), params: ratio }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("multiplier"), params: multiplierParams }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("journey_a_to_b"), params: journey }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("process_flow"), params: flowSteps }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("funnel_narrow"), params: funnel }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("milestone_path"), params: milestones }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("balance_seesaw"), params: seesaw }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("split_contrast"), params: splitContrast }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("scale_compare"), params: scaleCompare }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("spectrum_slider"), params: spectrum }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("parts_merge"), params: partsCount }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("parts_split"), params: partsCount }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("layer_stack"), params: layers }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("cluster_group"), params: cluster }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("sparkline_up"), params: dataPoints }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("bars_race"), params: dataPoints }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("arc_progress"), params: arc }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("pulse_highlight"), params: emphasis }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("ring_focus"), params: emphasis }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("check_complete"), params: emphasis }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("badge_unlock"), params: emphasis }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("bridge_link"), params: bridge }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("gap_close"), params: gap }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("network_nodes"), params: network }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("stagger_reveal"), params: stringList }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("checklist_ticks"), params: stringList }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("priority_rank"), params: priority }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("timeline_year"), params: timelineYear }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("venn_overlap"), params: vennOverlap }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("before_after_slider"), params: beforeAfterSlider }),
  z.object({ version: z.literal(1).default(1), pattern: z.literal("equation_balance"), params: equationBalance }),
]);

export type ExplainAnimationConfig = z.infer<typeof ExplainAnimationConfigSchema>;
