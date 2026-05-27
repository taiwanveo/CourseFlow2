import {
  generateVisualConfig,
  loadDesignTokensForTheme,
  shouldStepHaveVisual,
  type VisualConfig,
} from "@courseflow/visual-config";

export type StepVisualEntry = { step: number; config: VisualConfig };

export async function buildStepVisualConfigs(opts: {
  narrations: string[];
  screenContents: string[];
  themeId: string;
  articleExcerpt?: string;
}): Promise<StepVisualEntry[]> {
  const theme = await loadDesignTokensForTheme(opts.themeId);
  const out: StepVisualEntry[] = [];

  for (let step = 0; step < opts.narrations.length; step++) {
    const script = opts.narrations[step] ?? "";
    const screen = opts.screenContents[step] ?? "";
    if (!shouldStepHaveVisual(script, screen)) continue;

    const { config } = await generateVisualConfig({
      stepScript: script,
      articleSnippet: opts.articleExcerpt,
      theme,
    });
    out.push({ step, config });
  }
  return out;
}
