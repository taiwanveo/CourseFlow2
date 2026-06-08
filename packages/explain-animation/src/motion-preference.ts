import type { ExplainAnimationConfig, ExplainPatternId } from "./schema.js";
import { ExplainAnimationConfigSchema } from "./schema.js";
import { inferExplainAnimation, type InferExplainResult } from "./infer.js";

/** 章節級動效取向 */
export type ChapterMotionOrientation = "auto" | "data" | "flow" | "contrast" | "minimal";

/** 步驟級覆寫模式 */
export type StepMotionOverrideMode = "auto" | "none" | "pattern";

export interface StepMotionOverride {
  mode: StepMotionOverrideMode;
  patternId?: ExplainPatternId;
}

export type ExplainResolveSource =
  | "infer"
  | "orientation"
  | "forced"
  | "user_skip"
  | "minimal"
  | "fallback";

export type ExplainResolveKind = "explain" | "none" | "fallback";

export interface ResolvedExplainStep {
  kind: ExplainResolveKind;
  source: ExplainResolveSource;
  result: InferExplainResult | null;
  patternId?: ExplainPatternId;
  reason?: string;
}

export const ORIENTATION_PATTERN_PRIORITY: Record<
  Exclude<ChapterMotionOrientation, "auto" | "minimal">,
  readonly ExplainPatternId[]
> = {
  data: [
    "percent_grow",
    "counter_kpi",
    "sparkline_up",
    "bars_race",
    "value_compare",
    "ratio_split",
    "amount_add",
    "percent_shrink",
    "arc_progress",
  ],
  flow: [
    "process_flow",
    "timeline_year",
    "journey_a_to_b",
    "milestone_path",
    "funnel_narrow",
    "stagger_reveal",
    "checklist_ticks",
  ],
  contrast: [
    "before_after_slider",
    "split_contrast",
    "venn_overlap",
    "balance_seesaw",
    "value_compare",
    "scale_compare",
    "spectrum_slider",
  ],
};

export const CHAPTER_MOTION_ORIENTATION_LABELS: Record<ChapterMotionOrientation, string> = {
  auto: "自動（依內容推斷）",
  data: "數據圖表取向",
  flow: "流程歷程取向",
  contrast: "對比平衡取向",
  minimal: "極簡（少動效）",
};

export const STEP_MOTION_OVERRIDE_MODE_LABELS: Record<StepMotionOverrideMode, string> = {
  auto: "自動",
  none: "無解說動效",
  pattern: "指定 pattern",
};

/** 步驟覆寫下拉用：分組 pattern（僅 Motion 可渲染者） */
export const STEP_MOTION_PATTERN_GROUPS: ReadonlyArray<{
  groupLabel: string;
  patterns: readonly ExplainPatternId[];
}> = [
  {
    groupLabel: "數值",
    patterns: ["percent_grow", "counter_kpi", "sparkline_up", "bars_race", "value_compare"],
  },
  {
    groupLabel: "流程",
    patterns: ["process_flow", "timeline_year", "journey_a_to_b", "funnel_narrow"],
  },
  {
    groupLabel: "對比",
    patterns: ["before_after_slider", "split_contrast", "venn_overlap", "balance_seesaw"],
  },
  {
    groupLabel: "強調／清單",
    patterns: ["pulse_highlight", "stagger_reveal", "checklist_ticks"],
  },
];

export function parseChapterMotionOrientation(raw: unknown): ChapterMotionOrientation {
  if (raw === "data" || raw === "flow" || raw === "contrast" || raw === "minimal") return raw;
  return "auto";
}

export function parseStepMotionOverride(
  modeRaw: unknown,
  patternRaw: unknown,
): StepMotionOverride {
  if (modeRaw === "none") return { mode: "none" };
  if (modeRaw === "pattern" && typeof patternRaw === "string") {
    const patternId = patternRaw as ExplainPatternId;
    return { mode: "pattern", patternId };
  }
  return { mode: "auto" };
}

export function readStepMotionOverrideFromEntry(entry: {
  motionOverrideMode?: unknown;
  motionOverridePattern?: unknown;
}): StepMotionOverride {
  return parseStepMotionOverride(entry.motionOverrideMode, entry.motionOverridePattern);
}

function splitListItems(t: string): string[] {
  return t
    .split(/[；;、\n]/)
    .map((s) => s.replace(/^第[一二三四五六七八九十\d]+[步点、.．]\s*/, "").trim())
    .filter((s) => s.length >= 1 && s.length <= 24)
    .slice(0, 8);
}

function extractYears(text: string): number[] {
  const years: number[] = [];
  for (const m of text.matchAll(/(20\d{2}|19\d{2})年?/g)) {
    const y = Number.parseInt(m[1]!, 10);
    if (!years.includes(y)) years.push(y);
  }
  years.sort((a, b) => a - b);
  return years.slice(0, 8);
}

function headline(text: string, max = 12): string {
  const s = text.trim().replace(/\s*[｜|].*$/, "").slice(0, max);
  return s.length >= 2 ? s : "重點";
}

function wrapConfig(raw: ExplainAnimationConfig): InferExplainResult | null {
  const parsed = ExplainAnimationConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { config: parsed.data, confidence: "medium", reason: "偏好覆寫" };
}

/** 強制指定 pattern 時的保底參數（盡量用螢幕／口播片段） */
export function buildFallbackConfigForPattern(
  pattern: ExplainPatternId,
  script: string,
  screen: string,
): InferExplainResult | null {
  const combined = `${script}\n${screen}`.trim();
  const items = splitListItems(combined);
  const years = extractYears(combined);
  const short = headline(screen || script);

  const candidates: ExplainAnimationConfig[] = [];

  switch (pattern) {
    case "percent_grow":
      candidates.push({
        version: 1,
        pattern: "percent_grow",
        params: { beforeValue: 30, afterValue: 55, unit: "%", beforeLabel: "原本", afterLabel: "現在" },
      });
      break;
    case "percent_shrink":
      candidates.push({
        version: 1,
        pattern: "percent_shrink",
        params: { beforeValue: 60, afterValue: 35, unit: "%", beforeLabel: "原本", afterLabel: "現在" },
      });
      break;
    case "counter_kpi":
      candidates.push({
        version: 1,
        pattern: "counter_kpi",
        params: { target: 100, label: short, unit: "%" },
      });
      break;
    case "sparkline_up":
      candidates.push({
        version: 1,
        pattern: "sparkline_up",
        params: {
          points: [
            { label: "1", value: 12 },
            { label: "2", value: 18 },
            { label: "3", value: 24 },
            { label: "4", value: 32 },
          ],
          unit: "",
        },
      });
      break;
    case "bars_race":
      candidates.push({
        version: 1,
        pattern: "bars_race",
        params: {
          points: [
            { label: items[0] ?? "項目 A", value: 45 },
            { label: items[1] ?? "項目 B", value: 72 },
          ],
          unit: "",
        },
      });
      break;
    case "value_compare":
      candidates.push({
        version: 1,
        pattern: "value_compare",
        params: {
          left: 40,
          right: 72,
          leftLabel: items[0] ?? "A",
          rightLabel: items[1] ?? "B",
          unit: "",
        },
      });
      break;
    case "process_flow":
      candidates.push({
        version: 1,
        pattern: "process_flow",
        params: {
          steps: items.length >= 2 ? items : ["準備", "執行", "完成"],
        },
      });
      break;
    case "timeline_year":
      candidates.push({
        version: 1,
        pattern: "timeline_year",
        params: {
          years:
            years.length >= 2
              ? years.map((year) => ({ year }))
              : [{ year: 2022 }, { year: 2024 }, { year: 2026 }],
        },
      });
      break;
    case "journey_a_to_b":
      candidates.push({
        version: 1,
        pattern: "journey_a_to_b",
        params: { fromLabel: items[0] ?? "起點", toLabel: items[1] ?? "終點" },
      });
      break;
    case "funnel_narrow":
      candidates.push({
        version: 1,
        pattern: "funnel_narrow",
        params: {
          stages: [items[0] ?? "上層", items[1] ?? "下層"],
        },
      });
      break;
    case "before_after_slider":
      candidates.push({
        version: 1,
        pattern: "before_after_slider",
        params: { beforeLabel: "之前", afterLabel: "之後", sliderPosition: 0.5 },
      });
      break;
    case "split_contrast":
      candidates.push({
        version: 1,
        pattern: "split_contrast",
        params: {
          leftTitle: items[0] ?? "方案 A",
          rightTitle: items[1] ?? "方案 B",
          leftPoints: [short],
          rightPoints: [short],
        },
      });
      break;
    case "venn_overlap":
      candidates.push({
        version: 1,
        pattern: "venn_overlap",
        params: {
          leftLabel: items[0] ?? "A",
          rightLabel: items[1] ?? "B",
          overlapLabel: "交集",
        },
      });
      break;
    case "balance_seesaw":
      candidates.push({
        version: 1,
        pattern: "balance_seesaw",
        params: {
          leftLabel: items[0] ?? "左",
          rightLabel: items[1] ?? "右",
          sequence: ["left", "right", "balance"],
        },
      });
      break;
    case "pulse_highlight":
      candidates.push({
        version: 1,
        pattern: "pulse_highlight",
        params: { text: short },
      });
      break;
    case "stagger_reveal":
      candidates.push({
        version: 1,
        pattern: "stagger_reveal",
        params: { items: items.length >= 2 ? items : ["要點一", "要點二", "要點三"] },
      });
      break;
    case "checklist_ticks":
      candidates.push({
        version: 1,
        pattern: "checklist_ticks",
        params: { items: items.length >= 2 ? items : ["項目一", "項目二", "項目三"] },
      });
      break;
    default:
      candidates.push({
        version: 1,
        pattern: "pulse_highlight",
        params: { text: short },
      });
      break;
  }

  for (const raw of candidates) {
    const wrapped = wrapConfig(raw);
    if (wrapped) return wrapped;
  }
  return null;
}

function tryPattern(
  pattern: ExplainPatternId,
  script: string,
  screen: string,
): InferExplainResult | null {
  const inferred = inferExplainAnimation(script, screen);
  if (inferred?.config.pattern === pattern) return inferred;
  return buildFallbackConfigForPattern(pattern, script, screen);
}

function patternInOrientation(
  pattern: ExplainPatternId,
  orientation: ChapterMotionOrientation,
): boolean {
  if (orientation === "auto" || orientation === "minimal") return true;
  return ORIENTATION_PATTERN_PRIORITY[orientation].includes(pattern);
}

/**
 * 解析單步解說動效：手動覆寫 > 章節取向 > infer。
 */
export function resolveExplainForStep(
  script: string,
  screen: string,
  orientation: ChapterMotionOrientation,
  stepOverride?: StepMotionOverride,
): ResolvedExplainStep {
  if (stepOverride?.mode === "none") {
    return { kind: "none", source: "user_skip", result: null };
  }

  if (stepOverride?.mode === "pattern" && stepOverride.patternId) {
    const forced = tryPattern(stepOverride.patternId, script, screen);
    if (forced) {
      return {
        kind: "explain",
        source: "forced",
        result: forced,
        patternId: forced.config.pattern,
        reason: forced.reason,
      };
    }
    return { kind: "fallback", source: "forced", result: null, patternId: stepOverride.patternId };
  }

  const inferred = inferExplainAnimation(script, screen);

  if (orientation === "minimal") {
    if (inferred && inferred.confidence === "high") {
      return {
        kind: "explain",
        source: "minimal",
        result: inferred,
        patternId: inferred.config.pattern,
        reason: inferred.reason,
      };
    }
    return { kind: "none", source: "minimal", result: null };
  }

  if (orientation === "auto") {
    if (inferred) {
      return {
        kind: "explain",
        source: "infer",
        result: inferred,
        patternId: inferred.config.pattern,
        reason: inferred.reason,
      };
    }
    return { kind: "fallback", source: "infer", result: null };
  }

  if (inferred && patternInOrientation(inferred.config.pattern, orientation)) {
    return {
      kind: "explain",
      source: "infer",
      result: inferred,
      patternId: inferred.config.pattern,
      reason: inferred.reason,
    };
  }

  for (const pattern of ORIENTATION_PATTERN_PRIORITY[orientation]) {
    const oriented = tryPattern(pattern, script, screen);
    if (oriented) {
      return {
        kind: "explain",
        source: "orientation",
        result: oriented,
        patternId: oriented.config.pattern,
        reason: oriented.reason,
      };
    }
  }

  if (inferred) {
    return {
      kind: "explain",
      source: "infer",
      result: inferred,
      patternId: inferred.config.pattern,
      reason: inferred.reason,
    };
  }

  return { kind: "fallback", source: "orientation", result: null };
}

export function stepHasCraftAnimation(entry: {
  imageSource?: string;
  animationHtml?: string | null;
  animationConfig?: unknown;
}): boolean {
  if (entry.imageSource !== "animation") return false;
  if (entry.animationConfig && typeof entry.animationConfig === "object") return true;
  const html = entry.animationHtml?.trim() ?? "";
  return html.length > 0;
}

function combinedText(script: string, screen: string): string {
  return `${script}\n${screen}`.trim();
}

function hasNumericSignal(text: string): boolean {
  return /\d+%?|\d+\.\d+|\d+萬|\d+元|成長|下降|比率|數據|指标|指標/.test(text);
}

function hasFlowSignal(text: string): boolean {
  return /流程|步驟|阶段|階段|首先|接著|然后|然後|最後|第一|第二|第三|里程碑/.test(text);
}

function hasContrastSignal(text: string): boolean {
  return /對比|相比|之前|之後|原先|但是|然而|一方面|另一方面|前後|前后/.test(text);
}

export type StepMotionPlanRow = {
  stepIndex: number;
  scriptPreview: string;
  screenPreview: string;
  hasCraftAnimation: boolean;
  kind: ExplainResolveKind;
  source: ExplainResolveSource;
  patternId?: ExplainPatternId;
  warning?: string;
};

export type ChapterMotionPlan = {
  wvpChapterId: string;
  title: string;
  orientation: ChapterMotionOrientation;
  totalSteps: number;
  explainStepCount: number;
  fallbackStepCount: number;
  noneStepCount: number;
  craftAnimationStepCount: number;
  steps: StepMotionPlanRow[];
  warnings: string[];
};

export function planChapterMotionCoverage(input: {
  wvpChapterId: string;
  title: string;
  orientation: ChapterMotionOrientation;
  narrations: string[];
  screenContents: string[];
  stepIllustrations?: Array<{
    stepIndex: number;
    imageSource?: string;
    animationHtml?: string | null;
    animationConfig?: unknown;
    motionOverrideMode?: unknown;
    motionOverridePattern?: unknown;
  }>;
}): ChapterMotionPlan {
  const n = Math.max(input.narrations.length, input.screenContents.length);
  const illusByStep = new Map(
    (input.stepIllustrations ?? []).map((s) => [s.stepIndex, s] as const),
  );

  const steps: StepMotionPlanRow[] = [];
  const warnings: string[] = [];
  let explainStepCount = 0;
  let fallbackStepCount = 0;
  let noneStepCount = 0;
  let craftAnimationStepCount = 0;

  for (let step = 0; step < n; step++) {
    const script = input.narrations[step]?.trim() ?? "";
    const screen = input.screenContents[step]?.trim() ?? "";
    const entry = illusByStep.get(step);
    const hasCraftAnimation = entry ? stepHasCraftAnimation(entry) : false;
    if (hasCraftAnimation) craftAnimationStepCount++;

    if (!script && !screen) {
      steps.push({
        stepIndex: step,
        scriptPreview: "",
        screenPreview: "",
        hasCraftAnimation,
        kind: "none",
        source: "fallback",
      });
      noneStepCount++;
      continue;
    }

    if (hasCraftAnimation) {
      steps.push({
        stepIndex: step,
        scriptPreview: script.slice(0, 48),
        screenPreview: screen.slice(0, 48),
        hasCraftAnimation: true,
        kind: "explain",
        source: "forced",
        patternId: undefined,
      });
      explainStepCount++;
      continue;
    }

    const override = entry ? readStepMotionOverrideFromEntry(entry) : { mode: "auto" as const };
    const resolved = resolveExplainForStep(script, screen, input.orientation, override);

    if (resolved.kind === "explain") explainStepCount++;
    else if (resolved.kind === "fallback") fallbackStepCount++;
    else noneStepCount++;

    let warning: string | undefined;
    const text = combinedText(script, screen);
    if (
      input.orientation === "data" &&
      resolved.kind === "fallback" &&
      !hasNumericSignal(text)
    ) {
      warning = "已選數據取向，但此步缺少可辨識的數字或趨勢語意";
    } else if (
      input.orientation === "flow" &&
      resolved.kind === "fallback" &&
      !hasFlowSignal(text)
    ) {
      warning = "已選流程取向，但此步缺少流程／步驟語意";
    } else if (
      input.orientation === "contrast" &&
      resolved.kind === "fallback" &&
      !hasContrastSignal(text)
    ) {
      warning = "已選對比取向，但此步缺少對照語意";
    } else if (input.orientation === "minimal" && resolved.kind === "none" && inferExplainAnimation(script, screen)) {
      warning = "極簡模式下略過中等信心度的解說動效";
    }

    if (warning) warnings.push(`步驟 ${step + 1}：${warning}`);

    steps.push({
      stepIndex: step,
      scriptPreview: script.slice(0, 48),
      screenPreview: screen.slice(0, 48),
      hasCraftAnimation,
      kind: resolved.kind,
      source: resolved.source,
      patternId: resolved.patternId,
      warning,
    });
  }

  return {
    wvpChapterId: input.wvpChapterId,
    title: input.title,
    orientation: input.orientation,
    totalSteps: n,
    explainStepCount,
    fallbackStepCount,
    noneStepCount,
    craftAnimationStepCount,
    steps,
    warnings,
  };
}
