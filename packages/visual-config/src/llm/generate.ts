import { FALLBACK_CALLOUT, inferVisualConfigFromText } from "../heuristic.js";
import { sanitizeVisualConfig } from "../sanitize.js";
import { safeParseVisualConfig, type VisualConfig } from "../schema/visual.js";
import type { VisualDirectorPlan } from "../schema/visual-director.js";
import type { DesignTokens } from "../tokens/theme-bridge.js";
import { buildVisualConfigSystemPrompt, buildVisualConfigUserPrompt } from "./prompt.js";

export type LlmJsonCaller = (system: string, user: string) => Promise<string>;

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
}

export interface GenerateVisualConfigResult {
  config: VisualConfig;
  source: "llm" | "heuristic" | "fallback" | "director-skip";
  attempts: number;
  error?: string;
  directorPlan?: VisualDirectorPlan;
}

export async function generateVisualConfig(opts: {
  stepScript: string;
  screenContent?: string;
  articleSnippet?: string;
  theme: DesignTokens;
  directorPlan?: VisualDirectorPlan;
  llm?: LlmJsonCaller;
  maxRetries?: number;
}): Promise<GenerateVisualConfigResult> {
  const maxRetries = opts.maxRetries ?? 2;
  const director = opts.directorPlan;

  if (director?.recommendedOutput === "none") {
    return {
      config: FALLBACK_CALLOUT,
      source: "director-skip",
      attempts: 0,
      directorPlan: director,
      error: director.skipReason ?? "Visual Director 判定不建議生成視覺",
    };
  }

  if (director?.recommendedOutput === "ai-image") {
    return {
      config: FALLBACK_CALLOUT,
      source: "director-skip",
      attempts: 0,
      directorPlan: director,
      error: "本步由 AI 配圖處理，不使用 chart/table/animation",
    };
  }

  if (opts.llm) {
    const system = buildVisualConfigSystemPrompt(opts.theme);
    const baseUser = buildVisualConfigUserPrompt(
      opts.stepScript,
      opts.articleSnippet,
      opts.screenContent,
      director,
    );
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const user =
          attempt === 1
            ? baseUser
            : `${baseUser}\n\n【修正要求】\n你上一次輸出的 JSON 沒通過 schema 驗證。請只輸出合法 JSON，並確保：\n- chart.data[*][yKey] 為 number（單位放 unit）\n- xKey / yKey 與 data 欄位一致\n- table.columns.key 必須出現在 rows\n`;
        const raw = await opts.llm(system, user);
        const parsed = extractJsonObject(raw);
        const validated = safeParseVisualConfig(parsed);
        if (validated.success) {
          return {
            config: sanitizeVisualConfig(validated.data, {
              screenContent: opts.screenContent,
              stepScript: opts.stepScript,
            }),
            source: "llm",
            attempts: attempt,
            directorPlan: director,
          };
        }
      } catch {
        /* retry */
      }
    }
  }

  const heuristic = inferVisualConfigFromText(
    `${opts.screenContent?.trim() ?? ""}\n${opts.articleSnippet ?? ""}`.trim() ||
      opts.stepScript.slice(0, 120),
  );
  if (heuristic) {
    const validated = safeParseVisualConfig(heuristic);
    if (validated.success) {
      return {
        config: sanitizeVisualConfig(validated.data, {
          screenContent: opts.screenContent,
          stepScript: opts.stepScript,
        }),
        source: "heuristic",
        attempts: 0,
        directorPlan: director,
      };
    }
  }

  const screenLine =
    opts.screenContent?.trim().slice(0, 72) ||
    director?.coreMessage.slice(0, 72) ||
    "重點";
  const fallback: VisualConfig = {
    kind: "animation",
    title: screenLine.slice(0, 24) || "重點",
    pattern: "callout",
    items: [{ text: screenLine, emphasis: true }],
  };
  return {
    config: sanitizeVisualConfig(fallback, {
      screenContent: opts.screenContent,
      stepScript: opts.stepScript,
    }),
    source: "fallback",
    attempts: maxRetries,
    error: "llm/heuristic failed",
    directorPlan: director,
  };
}
