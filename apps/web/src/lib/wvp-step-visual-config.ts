import type { LlmProviderId } from "@courseflow/llm";
import {
  analyzeStepVisualPlan,
  generateVisualConfig,
  loadDesignTokensForTheme,
  shouldStepHaveVisual,
  type VisualConfig,
} from "@courseflow/visual-config";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";

export type StepVisualEntry = { step: number; config: VisualConfig };

export async function generateStepVisualConfigsForChapter(opts: {
  provider: LlmProviderId;
  apiKey: string;
  themeId: string;
  courseTopic?: string;
  narrations: string[];
  screenContents: string[];
  articleExcerpt?: string;
}): Promise<StepVisualEntry[]> {
  const theme = await loadDesignTokensForTheme(opts.themeId);
  const out: StepVisualEntry[] = [];
  const courseTopic = opts.courseTopic?.trim() || "教學課程";

  const llm = async (system: string, user: string) => {
    const obj = await generateChapterPlan({
      provider: opts.provider,
      apiKey: opts.apiKey,
      system,
      user,
    });
    return JSON.stringify(obj);
  };

  for (let step = 0; step < opts.narrations.length; step++) {
    const stepScript = opts.narrations[step] ?? "";
    const stepScreen = opts.screenContents[step] ?? "";
    if (!shouldStepHaveVisual(stepScript, stepScreen)) continue;

    const director = await analyzeStepVisualPlan({
      stepIndex: step,
      courseTopic,
      screenContent: stepScreen,
      stepScript,
      articleSnippet: opts.articleExcerpt,
      theme,
      llm,
      maxRetries: 2,
    });

    if (
      director.plan.recommendedOutput === "none" ||
      director.plan.recommendedOutput === "ai-image"
    ) {
      continue;
    }

    const r = await generateVisualConfig({
      stepScript,
      screenContent: stepScreen,
      articleSnippet: opts.articleExcerpt,
      theme,
      directorPlan: director.plan,
      llm,
      maxRetries: 2,
    });

    if (r.source === "director-skip") continue;

    if (r.config.kind === "animation" && r.config.pattern === "callout") {
      const blob = `${stepScript}\n${stepScreen}`;
      if (!/\d+/.test(blob) && !/(?:第一|第二|第三|對照|相比|占比|比例|趨勢)/.test(blob)) {
        continue;
      }
    }

    out.push({ step, config: r.config });
  }

  return out;
}
