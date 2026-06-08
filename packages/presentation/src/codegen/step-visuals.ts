import {
  analyzeStepVisualPlan,
  generateVisualConfig,
  inferVisualConfigFromText,
  loadDesignTokensForTheme,
  sanitizeVisualConfig,
  shouldStepHaveVisual,
  type VisualConfig,
} from "@courseflow/visual-config";

export type StepVisualEntry = { step: number; config: VisualConfig };

function stepVisualBlob(script: string, screen: string): string {
  return screen ? `${screen}\n${script}` : script;
}

function inferChartOrTableFromStep(script: string, screen: string): VisualConfig | null {
  const blob = stepVisualBlob(script, screen);
  if (blob.length < 6) return null;
  const config = inferVisualConfigFromText(blob);
  if (config?.kind === "chart" || config?.kind === "table") return config;
  return null;
}

/** 無 LLM stepVisualConfigs 時，從口播／螢幕文字啟發式補 chart/table */
export function buildHeuristicStepVisualConfigs(
  narrations: string[],
  screenContents: string[] = [],
): StepVisualEntry[] {
  const out: StepVisualEntry[] = [];
  for (let step = 0; step < narrations.length; step++) {
    const config = inferChartOrTableFromStep(
      narrations[step]?.trim() ?? "",
      screenContents[step]?.trim() ?? "",
    );
    if (config) out.push({ step, config });
  }
  return out;
}

/** 合併既有 config，並為缺漏步驟補啟發式 chart/table（啟發式優先覆寫同 step） */
export function mergeStepVisualConfigs(
  narrations: string[],
  screenContents: string[],
  existing: StepVisualEntry[] = [],
  skipSteps: ReadonlySet<number> = new Set(),
): StepVisualEntry[] {
  const byStep = new Map<number, StepVisualEntry>();
  // 明確提供的 stepVisualConfigs 一律保留（支援 visual + explain 複合版面）
  for (const entry of existing) {
    if (entry.config.kind === "chart" || entry.config.kind === "table") {
      byStep.set(entry.step, entry);
    }
  }
  // 啟發式 chart/table 可與同步解說動畫並存（visual-explain-composite）
  for (const entry of buildHeuristicStepVisualConfigs(narrations, screenContents)) {
    if (
      skipSteps.has(entry.step) &&
      entry.config.kind !== "chart" &&
      entry.config.kind !== "table"
    ) {
      continue;
    }
    byStep.set(entry.step, entry);
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}

/** 快取 TSX 是否缺少啟發式應有的 STEP_VISUALS（導致只顯示螢幕大字 fallback） */
export function tsxMissingStepVisualConfigs(
  tsx: string,
  narrations: string[],
  screenContents: string[] = [],
): boolean {
  const expected = buildHeuristicStepVisualConfigs(narrations, screenContents);
  if (expected.length === 0) return false;
  if (/UniversalStepChapter|STEP_DSL_CHAPTER/.test(tsx)) return false;
  if (!tsx.includes("VisualBlock")) return true;
  return expected.some((entry) => !tsx.includes(`STEP_VISUALS[${entry.step}]`));
}

export async function buildStepVisualConfigs(opts: {
  narrations: string[];
  screenContents: string[];
  themeId: string;
  courseTopic?: string;
  articleExcerpt?: string;
  llm?: (system: string, user: string) => Promise<string>;
}): Promise<StepVisualEntry[]> {
  const theme = await loadDesignTokensForTheme(opts.themeId);
  const out: StepVisualEntry[] = [];
  const courseTopic = opts.courseTopic?.trim() || "教學課程";

  for (let step = 0; step < opts.narrations.length; step++) {
    const script = opts.narrations[step] ?? "";
    const screen = opts.screenContents[step] ?? "";
    if (!shouldStepHaveVisual(script, screen)) continue;

    const director = await analyzeStepVisualPlan({
      stepIndex: step,
      courseTopic,
      screenContent: screen,
      stepScript: script,
      articleSnippet: opts.articleExcerpt,
      theme,
      llm: opts.llm,
      maxRetries: 2,
    });

    if (
      director.plan.recommendedOutput === "none" ||
      director.plan.recommendedOutput === "ai-image"
    ) {
      continue;
    }

    const { config } = await generateVisualConfig({
      stepScript: script,
      screenContent: screen,
      articleSnippet: opts.articleExcerpt,
      theme,
      directorPlan: director.plan,
      llm: opts.llm,
    });
    out.push({
      step,
      config: sanitizeVisualConfig(config, { screenContent: screen, stepScript: script }),
    });
  }
  return out;
}
