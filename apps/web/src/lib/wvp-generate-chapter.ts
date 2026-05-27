import OpenAI from "openai";
import type { LlmProviderId } from "@courseflow/llm";

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

  const client = new OpenAI({ apiKey: opts.apiKey, baseURL });
  const model =
    opts.model ??
    (opts.provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}
