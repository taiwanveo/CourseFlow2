import type { LlmProviderId } from "@courseflow/llm";
import {
  analyzeChapterVisualPlanBatch,
  analyzeStepVisualPlan,
  generateChapterVisualConfigsBatch,
  generateVisualConfig,
  loadDesignTokensForTheme,
  shouldStepHaveVisual,
  stepNeedsVisualDirector,
  type VisualConfig,
} from "@courseflow/visual-config";
import { buildHeuristicStepVisualConfigs as buildHeuristicFromPresentation } from "@courseflow/presentation";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";
import { shouldBatchVisualDirector } from "@/lib/wvp-craft-async";

export type StepVisualEntry = { step: number; config: VisualConfig };

/** 無 LLM stepVisualConfigs 時，從口播／螢幕文字啟發式補 chart/table（第六章等數據視覺章） */
export function buildHeuristicStepVisualConfigs(
  narrations: string[],
  screenContents: string[],
): StepVisualEntry[] {
  return buildHeuristicFromPresentation(narrations, screenContents);
}
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

function makeDirectorDecision(
  step: number,
  recommendedOutput: StepRecommendedOutput,
): StepVisualDecision {
  return {
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
}

function shouldFilterCalloutAnimation(
  stepScript: string,
  stepScreen: string,
  config: VisualConfig,
): boolean {
  if (config.kind !== "animation" || config.pattern !== "callout") return false;
  const teachingCue = /(?:流程|步驟|對照|比較|拆解|示意|架構|階段|循環|並列)/.test(
    `${stepScript}\n${stepScreen}`,
  );
  const blob = `${stepScript}\n${stepScreen}`;
  const hasCalloutSignal =
    /\d+/.test(blob) ||
    /(?:第一|第二|第三|對照|相比|占比|比例|趨勢|重點|關鍵|步驟)/.test(blob);
  return !hasCalloutSignal && !teachingCue;
}

/** 整章批次視覺決策（1–2 次 LLM），失敗時 fallback 逐步路徑 */
export async function generateStepVisualConfigsForChapterBatched(opts: {
  provider: LlmProviderId;
  apiKey: string;
  model?: string;
  themeId: string;
  courseTopic?: string;
  narrations: string[];
  screenContents: string[];
  articleExcerpt?: string;
}): Promise<{ configs: StepVisualEntry[]; decisions: StepVisualDecision[] }> {
  if (!shouldBatchVisualDirector()) {
    return generateStepVisualConfigsForChapter(opts);
  }

  const theme = await loadDesignTokensForTheme(opts.themeId);
  const courseTopic = opts.courseTopic?.trim() || "教學課程";
  const llm = async (system: string, user: string) => {
    const obj = await generateChapterPlan({
      provider: opts.provider,
      apiKey: opts.apiKey,
      model: opts.model,
      system,
      user,
    });
    return JSON.stringify(obj);
  };

  const decisions: StepVisualDecision[] = [];
  const directorCandidates: number[] = [];

  for (let step = 0; step < opts.narrations.length; step++) {
    const stepScript = opts.narrations[step] ?? "";
    const stepScreen = opts.screenContents[step] ?? "";
    if (!stepNeedsVisualDirector(stepScript, stepScreen)) {
      decisions.push({
        step,
        recommendedOutput: "none",
        reasonCode: "heuristic-no-visual",
        source: "heuristic",
        shouldIllustrate: false,
      });
      continue;
    }
    directorCandidates.push(step);
  }

  if (directorCandidates.length === 0) {
    return { configs: [], decisions };
  }

  const batchDirector = await analyzeChapterVisualPlanBatch({
    courseTopic,
    narrations: opts.narrations,
    screenContents: opts.screenContents,
    articleSnippet: opts.articleExcerpt,
    theme,
    llm,
    maxRetries: 2,
  });

  const directorByStep = new Map(batchDirector.steps.map((s) => [s.step, s.plan]));
  for (const step of directorCandidates) {
    const plan = directorByStep.get(step);
    if (!plan) continue;
    const recommendedOutput = plan.recommendedOutput as StepRecommendedOutput;
    decisions.push(makeDirectorDecision(step, recommendedOutput));
  }

  const configSteps = batchDirector.steps.filter((entry) => {
    const out = entry.plan.recommendedOutput;
    return out === "chart" || out === "table" || out === "animation";
  });

  const batchConfigs = await generateChapterVisualConfigsBatch({
    narrations: opts.narrations,
    screenContents: opts.screenContents,
    articleSnippet: opts.articleExcerpt,
    theme,
    directorSteps: configSteps,
    llm,
    maxRetries: 2,
  });

  const out: StepVisualEntry[] = [];
  for (const { step, config } of batchConfigs) {
    const stepScript = opts.narrations[step] ?? "";
    const stepScreen = opts.screenContents[step] ?? "";
    if (shouldFilterCalloutAnimation(stepScript, stepScreen, config)) {
      decisions.push({
        step,
        recommendedOutput: "none",
        reasonCode: "animation-callout-filtered",
        source: "heuristic",
        shouldIllustrate: false,
      });
      continue;
    }
    out.push({ step, config });
  }

  return { configs: out, decisions };
}

export async function generateStepVisualConfigsForChapter(opts: {
  provider: LlmProviderId;
  apiKey: string;
  model?: string;
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
      model: opts.model,
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
    const teachingCue = /(?:流程|步驟|對照|比較|拆解|示意|架構|階段|循環|並列)/.test(
      `${stepScript}\n${stepScreen}`,
    );
    if (!preDecision && !shouldStepHaveVisual(stepScript, stepScreen) && !teachingCue) {
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
    decisions.push(makeDirectorDecision(step, recommendedOutput));

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

    if (shouldFilterCalloutAnimation(stepScript, stepScreen, r.config)) {
      decisions.push({
        step,
        recommendedOutput: "none",
        reasonCode: "animation-callout-filtered",
        source: "heuristic",
        shouldIllustrate: false,
      });
      continue;
    }

    out.push({ step, config: r.config });
  }

  return { configs: out, decisions };
}
