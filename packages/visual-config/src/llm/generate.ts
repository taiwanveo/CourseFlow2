import { FALLBACK_CALLOUT, inferVisualConfigFromText } from "../heuristic.js";
import { safeParseVisualConfig, type VisualConfig } from "../schema/visual.js";
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
  source: "llm" | "heuristic" | "fallback";
  attempts: number;
  error?: string;
}

export async function generateVisualConfig(opts: {
  stepScript: string;
  articleSnippet?: string;
  theme: DesignTokens;
  llm?: LlmJsonCaller;
  maxRetries?: number;
}): Promise<GenerateVisualConfigResult> {
  const maxRetries = opts.maxRetries ?? 2;

  if (opts.llm) {
    const system = buildVisualConfigSystemPrompt(opts.theme);
    const baseUser = buildVisualConfigUserPrompt(opts.stepScript, opts.articleSnippet);
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
          return { config: validated.data, source: "llm", attempts: attempt };
        }
      } catch {
        /* retry */
      }
    }
  }

  const heuristic = inferVisualConfigFromText(
    `${opts.stepScript}\n${opts.articleSnippet ?? ""}`,
  );
  if (heuristic) {
    const validated = safeParseVisualConfig(heuristic);
    if (validated.success) {
      return { config: validated.data, source: "heuristic", attempts: 0 };
    }
  }

  const fallback: VisualConfig = {
    kind: "animation",
    title: "重點",
    pattern: "callout",
    items: [{ text: opts.stepScript.trim().slice(0, 72) || "重點", emphasis: true }],
  };
  return { config: fallback, source: "fallback", attempts: maxRetries, error: "llm/heuristic failed" };
}
