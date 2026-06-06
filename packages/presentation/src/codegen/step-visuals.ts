import {
  analyzeStepVisualPlan,
  generateVisualConfig,
  loadDesignTokensForTheme,
  sanitizeVisualConfig,
  shouldStepHaveVisual,
  type VisualConfig,
} from "@courseflow/visual-config";

export type StepVisualEntry = { step: number; config: VisualConfig };

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
