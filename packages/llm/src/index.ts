import OpenAI from "openai";
import type { LlmCredentials } from "./types.js";
import {
  OUTLINE_SYSTEM_PROMPT,
  SCRIPT_SYSTEM_PROMPT,
  buildOutlineUserPrompt,
  buildScriptUserPrompt,
  parseOutlineJson,
  parseScriptsJson,
  MARKDOWN_TO_COURSE_SYSTEM_PROMPT,
  buildMarkdownToCourseUserPrompt,
  parseUnifiedCourseJson,
} from "./prompts.js";
import type { GeneratedOutline } from "./types.js";
import { generateTeachingArticle } from "./generate-article.js";

export interface GeneratedCourse {
  outline: GeneratedOutline;
  /** Call 1 生成的 Markdown 教學文稿（提示詞模式時為 AI 自動撰寫）。 */
  article: string;
}

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
 * 兩步驟課程生成：
 * 1. 請求 LLM 生成 H1/H2/H3 階層 Markdown 教學文稿（提示詞模式）或直接使用傳入的文稿（文稿模式）
 * 2. 將 Markdown 轉換為課程 JSON，每步驟「先寫 script → 再從 script 提煉 screenContent」
 *
 * @returns GeneratedCourse 包含 outline 和中間文稿（article）
 */
export async function generateCourse(
  creds: LlmCredentials,
  input: string,
  language: string,
): Promise<GeneratedCourse> {
  // Step 1：若為提示詞（< 300 字）則先生成 Markdown 教學文稿；否則直接使用傳入內容
  const article = input.trim().length < 300
    ? await generateTeachingArticle(creds, input, language)
    : input;

  // Step 2：將 Markdown 文稿轉換為課程 JSON（script 先於 screenContent）
  const raw = await chatJson(
    creds,
    MARKDOWN_TO_COURSE_SYSTEM_PROMPT,
    buildMarkdownToCourseUserPrompt(article, language),
    0.35,
  );
  const outline = parseUnifiedCourseJson(raw);
  return { outline, article };
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
export { generateChapterImage, buildChapterImagePrompt } from "./generate-chapter-image.js";
