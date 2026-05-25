import OpenAI from "openai";
import type { LlmCredentials } from "./types.js";

const DEFAULT_MODELS: Record<LlmCredentials["provider"], string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

export const ARTICLE_GENERATION_SYSTEM_PROMPT = `你是資深教學內容撰稿人，擅長撰寫結構清晰、可直接作為線上課程「教學原文」的教材。

要求：
1. 依使用者的提示詞（主題、字數、大綱、受眾等）撰寫完整教材正文。
2. 使用 Markdown 或純文字皆可；以標題、段落、條列呈現，層次分明。
3. 內容須涵蓋使用者指定的大綱要點，教學語氣專業且易懂。
4. 遵守使用者指定的字數上限；若未指定，預設約 1500~2500 字。
5. 只輸出教材正文，不要前言後語（例如「以下是…」）、不要 JSON、不要用 markdown 程式碼區塊包裹全文。`;

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

export async function generateTeachingArticle(
  creds: LlmCredentials,
  userPrompt: string,
  language: string,
): Promise<string> {
  const client = createClient(creds);
  const model = creds.model ?? DEFAULT_MODELS[creds.provider];
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: ARTICLE_GENERATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `輸出語言：${language}\n\n使用者需求：\n${userPrompt.trim()}`,
      },
    ],
    temperature: 0.65,
  });
  const content = res.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM 回傳空內容");
  return content.replace(/^```(?:markdown|md|text)?\s*/i, "").replace(/```\s*$/i, "").trim();
}
