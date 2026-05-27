import OpenAI from "openai";
import type { LlmCredentials } from "./types.js";
import {
  OUTLINE_SYSTEM_PROMPT,
  SCRIPT_SYSTEM_PROMPT,
  buildOutlineUserPrompt,
  buildScriptUserPrompt,
  parseOutlineJson,
  parseScriptsJson,
} from "./prompts.js";
import type { GeneratedOutline } from "./types.js";

const DEFAULT_MODELS: Record<LlmCredentials["provider"], string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

function createClient(creds: LlmCredentials): OpenAI {
  if (creds.provider === "openrouter") {
    return new OpenAI({
      apiKey: creds.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  if (creds.provider === "gemini") {
    return new OpenAI({
      apiKey: creds.apiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  return new OpenAI({ apiKey: creds.apiKey });
}

async function chatJson(
  creds: LlmCredentials,
  system: string,
  user: string,
  temperature = 0.4,
): Promise<string> {
  const client = createClient(creds);
  const model = creds.model ?? DEFAULT_MODELS[creds.provider];
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature,
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("LLM 回傳空內容");
  return content;
}

export async function generateOutline(
  creds: LlmCredentials,
  article: string,
  language: string,
): Promise<GeneratedOutline> {
  const raw = await chatJson(
    creds,
    OUTLINE_SYSTEM_PROMPT,
    buildOutlineUserPrompt(article, language),
  );
  return parseOutlineJson(raw);
}

export async function generateScripts(
  creds: LlmCredentials,
  steps: { id: string; screenContent: string; infoPool: string[] }[],
  context: { language: string; summary: string; articleExcerpt: string },
): Promise<Map<string, string>> {
  const raw = await chatJson(
    creds,
    SCRIPT_SYSTEM_PROMPT,
    buildScriptUserPrompt(steps, context),
    0.55,
  );
  const scripts = parseScriptsJson(raw);
  const map = new Map<string, string>();
  scripts.forEach((s, i) => {
    const step = steps[s.stepIndex ?? i];
    if (step) map.set(step.id, s.script);
  });
  return map;
}

/**
 * @deprecated v2 使用 @courseflow/craft-agent 章節程式生成，不再產 Konva 佈局 JSON。
 */
export async function generateVisualDraft(
  _creds: LlmCredentials,
  _step: { screenContent: string; infoPool: string[]; themeMood: string[] },
): Promise<{ enterAnimationId: string; elements: unknown[] }> {
  throw new Error(
    "v2 已停用 generateVisualDraft；請使用章節 Craft（@courseflow/craft-agent）",
  );
}

export * from "./types.js";
export * from "./prompts.js";
export {
  generateTeachingArticle,
  ARTICLE_GENERATION_SYSTEM_PROMPT,
} from "./generate-article.js";
export { generateStepImage, buildStepImagePrompt, IMAGE_GENERATION_PROVIDERS } from "./generate-step-image.js";
export type { StepImageDirectorHints } from "./generate-step-image.js";
