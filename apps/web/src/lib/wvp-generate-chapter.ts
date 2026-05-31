import OpenAI from "openai";
import type { LlmProviderId } from "@courseflow/llm";

const DEFAULT_WVP_LLM_TIMEOUT_MS = 60_000;
const DEFAULT_WVP_LLM_MAX_RETRIES = 1;

function resolveWvpLlmTimeoutMs(): number {
  const raw = process.env.WVP_LLM_TIMEOUT_MS;
  if (!raw) return DEFAULT_WVP_LLM_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_WVP_LLM_TIMEOUT_MS;
  return Math.floor(parsed);
}

function resolveWvpLlmMaxRetries(): number {
  const raw = process.env.WVP_LLM_MAX_RETRIES;
  if (!raw) return DEFAULT_WVP_LLM_MAX_RETRIES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_WVP_LLM_MAX_RETRIES;
  return Math.min(3, Math.floor(parsed));
}

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function generateChapterPlan(opts: {
  provider: LlmProviderId;
  apiKey: string;
  system: string;
  user: string;
  model?: string;
}): Promise<Record<string, unknown>> {
  const baseURL =
    opts.provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : opts.provider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta/openai/"
        : undefined;

  const timeout = resolveWvpLlmTimeoutMs();
  const maxRetries = resolveWvpLlmMaxRetries();
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL,
    timeout,
    maxRetries,
  });
  const model =
    opts.model ??
    (opts.provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");

  const res = await withTimeout(
    client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    }),
    timeout,
    `LLM 請求逾時（>${Math.floor(timeout / 1000)} 秒）`,
  );
  const raw = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}
