import OpenAI from "openai";
import type { LlmCredentials } from "./types.js";

/**
 * 題目 / 簡短需求 → Markdown 教學文稿 的專用生成器。
 *
 * 這是 CourseFlow 在「只有題目、還沒有完整教材」時的第一段文字生成入口。
 * 這裡生成的 Markdown 文稿，之後會再被轉成課程 JSON。
 */
const DEFAULT_MODELS: Record<LlmCredentials["provider"], string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

/**
 * 教學文稿生成的 system prompt。
 *
 * 若未來要調整試用期自動生文稿的風格，例如章節數量、段落長度、Markdown 結構、台灣繁中用詞，改這裡。
 */
export const ARTICLE_GENERATION_SYSTEM_PROMPT = `你是資深教學內容撰稿人，依使用者指定的主題撰寫結構清晰的教學文稿。

【格式要求】
1. 使用 Markdown 標題階層：
   # 課程標題（全文唯一 H1）
   ## 章節名稱（H2，代表一個教學主題）
   ### 子題目（H3，視需要使用）
   每個章節下面緊接段落正文說明該主題。
2. 每個 H2 章節至少有 1~3 段正文（每段 50~150 字），清楚說明概念、原因、範例或步驟。
3. 章節數依主題決定（通常 3~6 個 H2），含「前言」（第一個章節）與「結語」（最後一個章節）。
4. 遵守使用者指定的字數上限；若未指定，預設約 1500~2500 字。
5. 台灣繁體中文，禁止使用中國大陸慣用詞（程序/代碼/界面/視頻/數據/網絡）。
6. 只輸出教材正文，不要前言後語（例如「以下是…」），不要 JSON，不要 markdown 程式碼區塊包裹全文。`;

/** 根據 provider 建立對應的 OpenAI-compatible client；這裡只負責 transport，不負責 prompt。 */
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

/**
 * 執行一次教學文稿生成。
 *
 * 請注意：這裡送給模型的 user content 只有「語言 + 使用者需求」，
 * 所以真正決定文稿規格的是上面的 `ARTICLE_GENERATION_SYSTEM_PROMPT`。
 */
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
