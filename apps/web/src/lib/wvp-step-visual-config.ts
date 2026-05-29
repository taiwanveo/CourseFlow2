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
export type StepRecommendedOutput = "ai-image" | "chart" | "table" | "animation" | "none";
export type StepVisualDecision = {
  step: number;
  recommendedOutput: StepRecommendedOutput;
  reasonCode:
    | "heuristic-no-visual"
    | "director-ai-image"
    | "director-none"
    | "director-non-image"
    | "director-skip"
    | "animation-callout-filtered";
  source: "heuristic" | "director";
  shouldIllustrate: boolean;
};

export async function generateStepVisualConfigsForChapter(opts: {
  provider: LlmProviderId;
  apiKey: string;
  themeId: string;
  courseTopic?: string;
  narrations: string[];
  screenContents: string[];
  articleExcerpt?: string;
  decisions?: StepVisualDecision[];
}): Promise<{ configs: StepVisualEntry[]; decisions: StepVisualDecision[] }> {
  const theme = await loadDesignTokensForTheme(opts.themeId);
  const out: StepVisualEntry[] = [];
  const decisionMap = new Map<number, StepVisualDecision>();
  for (const d of opts.decisions ?? []) decisionMap.set(d.step, d);
  const decisions: StepVisualDecision[] = [];
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
    const preDecision = decisionMap.get(step);
    if (preDecision) {
      decisions.push(preDecision);
      if (!preDecision.shouldIllustrate || preDecision.recommendedOutput !== "animation") continue;
    }
    if (!preDecision && !shouldStepHaveVisual(stepScript, stepScreen)) {
      decisions.push({
        step,
        recommendedOutput: "none",
        reasonCode: "heuristic-no-visual",
        source: "heuristic",
        shouldIllustrate: false,
      });
      continue;
    }

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
    const recommendedOutput = director.plan.recommendedOutput as StepRecommendedOutput;
    const decision: StepVisualDecision = {
      step,
      recommendedOutput,
      reasonCode:
        recommendedOutput === "ai-image"
          ? "director-ai-image"
          : recommendedOutput === "none"
            ? "director-none"
            : "director-non-image",
      source: "director",
      shouldIllustrate: recommendedOutput !== "none",
    };
    decisions.push(decision);

    if (recommendedOutput === "none" || recommendedOutput === "ai-image") {
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

    if (r.source === "director-skip") {
      decisions.push({
        step,
        recommendedOutput: "none",
        reasonCode: "director-skip",
        source: "director",
        shouldIllustrate: false,
      });
      continue;
    }

    if (r.config.kind === "animation" && r.config.pattern === "callout") {
      const blob = `${stepScript}\n${stepScreen}`;
      if (!/\d+/.test(blob) && !/(?:第一|第二|第三|對照|相比|占比|比例|趨勢)/.test(blob)) {
        decisions.push({
          step,
          recommendedOutput: "none",
          reasonCode: "animation-callout-filtered",
          source: "heuristic",
          shouldIllustrate: false,
        });
        continue;
      }
    }

    out.push({ step, config: r.config });
  }

  return { configs: out, decisions };
}
