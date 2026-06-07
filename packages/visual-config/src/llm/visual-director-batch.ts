import type { LlmJsonCaller } from "./generate.js";
import {
  safeParseVisualDirectorPlan,
  type VisualDirectorPlan,
} from "../schema/visual-director.js";
import { safeParseVisualConfig, type VisualConfig } from "../schema/visual.js";
import { sanitizeVisualConfig } from "../sanitize.js";
import type { DesignTokens } from "../tokens/theme-bridge.js";
import {
  buildVisualDirectorSystemPrompt,
  buildVisualDirectorBatchUserPrompt,
  buildVisualConfigBatchSystemPrompt,
  buildVisualConfigBatchUserPrompt,
} from "./visual-director-prompt.js";
import { analyzeStepVisualPlan } from "./visual-director.js";
import { generateVisualConfig } from "./generate.js";
import { shouldStepHaveVisual } from "../detect.js";

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
}

export type ChapterStepDirectorEntry = {
  step: number;
  plan: VisualDirectorPlan;
};

export type ChapterStepConfigEntry = {
  step: number;
  config: VisualConfig;
};

/** 整章一次產出各步驟的 Visual Director 計畫 */
export async function analyzeChapterVisualPlanBatch(opts: {
  courseTopic: string;
  narrations: string[];
  screenContents: string[];
  articleSnippet?: string;
  theme: DesignTokens;
  llm?: LlmJsonCaller;
  maxRetries?: number;
}): Promise<{ steps: ChapterStepDirectorEntry[]; source: "llm" | "fallback" }> {
  const stepCount = opts.narrations.length;
  const maxRetries = opts.maxRetries ?? 2;

  if (opts.llm && stepCount > 0) {
    const system = buildVisualDirectorSystemPrompt(opts.theme);
    const user = buildVisualDirectorBatchUserPrompt({
      courseTopic: opts.courseTopic,
      narrations: opts.narrations,
      screenContents: opts.screenContents,
      articleSnippet: opts.articleSnippet,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const raw = await opts.llm(
          system,
          attempt === 1
            ? user
            : `${user}\n\n【修正】請只輸出合法 JSON：{ "steps": [ { "step": 0, "screenSummary": "...", ... } ] }，step 從 0 到 ${stepCount - 1}。`,
        );
        const parsed = extractJsonObject(raw) as { steps?: unknown };
        const stepsRaw = Array.isArray(parsed.steps) ? parsed.steps : [];
        const steps: ChapterStepDirectorEntry[] = [];
        for (let step = 0; step < stepCount; step++) {
          const item = stepsRaw.find(
            (s) =>
              s &&
              typeof s === "object" &&
              (s as { step?: number }).step === step,
          );
          const validated = safeParseVisualDirectorPlan(item ?? {});
          if (validated.success) {
            steps.push({ step, plan: validated.data });
          } else {
            const fallback = await analyzeStepVisualPlan({
              stepIndex: step,
              courseTopic: opts.courseTopic,
              screenContent: opts.screenContents[step] ?? "",
              stepScript: opts.narrations[step] ?? "",
              articleSnippet: opts.articleSnippet,
              theme: opts.theme,
            });
            steps.push({ step, plan: fallback.plan });
          }
        }
        if (steps.length === stepCount) {
          return { steps, source: "llm" };
        }
      } catch {
        /* retry */
      }
    }
  }

  const steps: ChapterStepDirectorEntry[] = [];
  for (let step = 0; step < stepCount; step++) {
    const fallback = await analyzeStepVisualPlan({
      stepIndex: step,
      courseTopic: opts.courseTopic,
      screenContent: opts.screenContents[step] ?? "",
      stepScript: opts.narrations[step] ?? "",
      articleSnippet: opts.articleSnippet,
      theme: opts.theme,
    });
    steps.push({ step, plan: fallback.plan });
  }
  return { steps, source: "fallback" };
}

/** 整章一次產出 chart/table/animation 的 VisualConfig */
export async function generateChapterVisualConfigsBatch(opts: {
  narrations: string[];
  screenContents: string[];
  articleSnippet?: string;
  theme: DesignTokens;
  directorSteps: ChapterStepDirectorEntry[];
  llm?: LlmJsonCaller;
  maxRetries?: number;
}): Promise<ChapterStepConfigEntry[]> {
  const needsConfig = opts.directorSteps.filter((entry) => {
    const out = entry.plan.recommendedOutput;
    return out === "chart" || out === "table" || out === "animation";
  });

  if (needsConfig.length === 0) return [];

  if (opts.llm) {
    const maxRetries = opts.maxRetries ?? 2;
    const system = buildVisualConfigBatchSystemPrompt(opts.theme);
    const user = buildVisualConfigBatchUserPrompt({
      narrations: opts.narrations,
      screenContents: opts.screenContents,
      articleSnippet: opts.articleSnippet,
      directorSteps: needsConfig,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const raw = await opts.llm(
          system,
          attempt === 1
            ? user
            : `${user}\n\n【修正】請只輸出合法 JSON：{ "configs": [ { "step": 0, "kind": "chart", ... } ] }`,
        );
        const parsed = extractJsonObject(raw) as { configs?: unknown };
        const configsRaw = Array.isArray(parsed.configs) ? parsed.configs : [];
        const out: ChapterStepConfigEntry[] = [];
        for (const entry of needsConfig) {
          const item = configsRaw.find(
            (c) =>
              c &&
              typeof c === "object" &&
              (c as { step?: number }).step === entry.step,
          );
          const validated = safeParseVisualConfig(item ?? {});
          if (validated.success) {
            out.push({
              step: entry.step,
              config: sanitizeVisualConfig(validated.data, {
                screenContent: opts.screenContents[entry.step],
                stepScript: opts.narrations[entry.step],
              }),
            });
          }
        }
        if (out.length === needsConfig.length) {
          return out;
        }
      } catch {
        /* retry */
      }
    }
  }

  const out: ChapterStepConfigEntry[] = [];
  for (const entry of needsConfig) {
    const r = await generateVisualConfig({
      stepScript: opts.narrations[entry.step] ?? "",
      screenContent: opts.screenContents[entry.step] ?? "",
      articleSnippet: opts.articleSnippet,
      theme: opts.theme,
      directorPlan: entry.plan,
      llm: opts.llm,
    });
    if (r.source !== "director-skip") {
      out.push({ step: entry.step, config: r.config });
    }
  }
  return out;
}

/** 啟發式判斷步驟是否應有視覺（與逐步路徑一致） */
export function stepNeedsVisualDirector(
  stepScript: string,
  stepScreen: string,
): boolean {
  const teachingCue = /(?:流程|步驟|對照|比較|拆解|示意|架構|階段|循環|並列)/.test(
    `${stepScript}\n${stepScreen}`,
  );
  return shouldStepHaveVisual(stepScript, stepScreen) || teachingCue;
}
