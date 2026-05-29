import type { GeneratedOutline } from "./types.js";

/** v2 — 對齊 WVP OUTLINE-FORMAT：節拍優先、螢幕 ≤1 行、清單 1 項 = 1 step */
export const OUTLINE_SYSTEM_PROMPT = `你是資深教學影片總編，擅長把原文轉成「Web Video Presentation」開發用大綱。

核心原則（必守）：
1. **一步一节拍**：每個 step 只承載口播會「單獨念出」的一個重點；講者會逐項念的列表，必須拆成多個 step（1 項 = 1 step）。
2. **screenContent（螢幕重點）**：要寫成該步口播的 **Key Points（重點點位）**，不是單一口號。請輸出 **1~3 個重點片語**，可用「／、｜、・」分隔；建議總長 **18~56 字**（通常 1~2 行）。禁止寫完整口播句、禁止寒暄口吻、禁止寫「大家好」「接下來我們要…」，並且**禁止使用省略符號（… 或 ...）**。
3. **口播與螢幕嚴格分離（極重要）**：
   - screenContent 絕對不是口播稿，也絕對不能預寫口播會念出的完整句子。
   - 禁止把未來口播內容複製、改寫或摘要後塞進 screenContent。
   - 若某句只適合「念出來」而不適合「印在投影片上」，只能放進後續 script，不能放進 screenContent。
   - 反例（禁止）：screenContent 寫「首先我們來看三個重點，第一是…」—— 這是口播，不是螢幕標語。
   - 正例（允許）：screenContent 寫「三個重點」或「重點一：需求定義」。
4. **infoPool**：每章在 chapter 層收錄從原文抽的數字、引用、案例、標籤，供章節 Craft 掛畫面細節（雙源原則）。長句、解釋、例子放 infoPool，不要塞進 screenContent。
5. **relationHint**（可選）：步級提示如 list-reveal、contrast、hook、progression —— 只描述內容關係，**禁止**寫動畫類型或 CSS 手段。
6. **節奏**：estimatedSeconds 依口播字數 ÷ 4（中文約 4 字/秒），單步常見 3~12 秒；一章約 60~180 秒。
7. **wvpChapterId**：小寫連字符英文 id（如 coldopen、why-agent），將成為 presentation 資料夾名。
8. 只規劃節奏與內容密度，不規劃動畫。
9. 用詞必須採用台灣繁體中文慣用詞（例如：程式設計、介面、滑鼠、網路、影片、資訊、資料、設定），避免中國大陸慣用詞（例如：編程、界面、鼠標、網絡、視頻、信息、數據、配置）。
10. 輸出合法 JSON，勿 markdown 包裹。`;

export function buildOutlineUserPrompt(article: string, language: string): string {
  return `語言：${language}

教學原文：
"""
${article.slice(0, 120000)}
"""

撰寫時請自檢：
1) 每個 screenContent 都要是 1~3 個 Key Points（重點點位），不是單一口號。
2) 若 screenContent 念起來像完整講稿，必須改寫成重點片語。
3) 若 screenContent 少於 10 字，通常過短，請補足為多個重點點位。
4) screenContent 內禁止使用「…」或「...」。
5) 每個重點片語必須語意完整，禁止以「使得、因此、透過這樣的方式、這些概念」等連接詞殘句開頭。

請輸出 JSON：
{
  "summary": "200~400 字課程總覽",
  "chapters": [
    {
      "title": "章節中文標題",
      "wvpChapterId": "hook",
      "sortOrder": 0,
      "chapterInfoPool": ["數字/引用/案例 —— 來源段落"],
      "steps": [
        {
          "screenContent": "該步 1~3 個螢幕重點片語（可用／分隔，非完整口播句）",
          "infoPool": ["本步可掛的畫面細節"],
          "relationHint": "list-reveal",
          "estimatedSeconds": 8
        }
      ],
      "children": []
    }
  ]
}`;
}

export const SCRIPT_SYSTEM_PROMPT = `你是經驗豐富的教授，為「Web Video Presentation」錄製口播。每個 step 對應 narrations 陣列中的一项。

硬性規則：
1. **一步一段口播**：每個 stepIndex 只寫該節拍口播，禁止在一步內念完「第一…第二…第三…」整份列表。
2. **口播與螢幕嚴格分離（極重要）**：
   - 口播（script）絕對不可以與同一步的 screenContent 過於接近；禁止「照稿念螢幕」。
   - 禁止以 screenContent 為開頭複讀、改寫或逐字擴寫；至少 70% 的句子必須是螢幕上沒出現的新資訊（定義、因果、例子、類比、提醒）。
   - 可以把 screenContent 當作「觀眾已看到的標題」，口播負責「講清楚標題背後的意思」。
   - 反例（禁止）：screenContent「三個重點」→ script「接下來我們看三個重點」。
   - 正例（允許）：screenContent「三個重點」→ script 解釋為什麼需要這三點、各點之間的關係，並舉一個具體情境。
3. 每步約 3~10 句（視 estimatedSeconds 調整），口語、無 markdown。
4. 善用 chapterInfoPool 與步級 infoPool 補充細節，不要重複螢幕已顯示的字面內容。
5. 輸出 JSON：{ "scripts": [ { "stepIndex": 0, "script": "..." } ] }`;

export function buildScriptUserPrompt(
  steps: {
    id: string;
    screenContent: string;
    infoPool: string[];
    relationHint?: string;
  }[],
  context: {
    language: string;
    summary: string;
    articleExcerpt: string;
    chapterInfoPool?: string[];
  },
): string {
  return `語言：${context.language}

課程摘要：
${context.summary}

章節信息池：
${JSON.stringify(context.chapterInfoPool ?? [], null, 2)}

原文摘錄：
"""
${context.articleExcerpt.slice(0, 24000)}
"""

為以下步驟撰寫口播（一步一段，列表已拆步）。

提醒：下列 screenContent 是「投影片上已顯示的短標語」，不是要你念出來的稿子。請寫出口播獨有的解釋與延伸，避免與 screenContent 用字高度重疊。

${JSON.stringify(
    steps.map((s, i) => ({
      stepIndex: i,
      screenContent: s.screenContent,
      infoPool: s.infoPool,
      relationHint: s.relationHint,
    })),
    null,
    2,
  )}`;
}

export function parseOutlineJson(text: string): GeneratedOutline {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedOutline;
  if (!parsed.chapters?.length) {
    throw new Error("LLM 未產生有效章節");
  }
  return parsed;
}

export function parseScriptsJson(
  text: string,
): { stepIndex: number; script: string }[] {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { scripts: { stepIndex: number; script: string }[] };
  return parsed.scripts ?? [];
}
