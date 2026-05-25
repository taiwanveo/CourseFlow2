import type { GeneratedOutline } from "./types.js";

/** v2 — 對齊 WVP OUTLINE-FORMAT：節拍優先、螢幕 ≤1 行、清單 1 項 = 1 step */
export const OUTLINE_SYSTEM_PROMPT = `你是資深教學影片總編，擅長把原文轉成「Web Video Presentation」開發用大綱。

核心原則（必守）：
1. **一步一节拍**：每個 step 只承載口播會「單獨念出」的一個重點；講者會逐項念的列表，必須拆成多個 step（1 項 = 1 step）。
2. **screenContent**：一句話描述本步舞台上最突出的 1~3 個元素（hero 標語 / 一個數字 / 單一列表項），**不超過 1 行、約 8~40 字**，不是投影片全文。
3. **口說與螢幕分離**：screenContent 不是口說稿；口說由後續 script 階段撰寫，且會比螢幕更豐富。
4. **infoPool**：每章在 chapter 層收錄從原文抽的數字、引用、案例、標籤，供章節 Craft 掛畫面細節（雙源原則）。
5. **relationHint**（可選）：步級提示如 list-reveal、contrast、hook、progression —— 只描述內容關係，**禁止**寫動畫類型或 CSS 手段。
6. **節奏**：estimatedSeconds 依口播字數 ÷ 4（中文約 4 字/秒），單步常見 3~12 秒；一章約 60~180 秒。
7. **wvpChapterId**：小寫連字符英文 id（如 coldopen、why-agent），將成為 presentation 資料夾名。
8. 只規劃節奏與內容密度，不規劃動畫。
9. 輸出合法 JSON，勿 markdown 包裹。`;

export function buildOutlineUserPrompt(article: string, language: string): string {
  return `語言：${language}

教學原文：
"""
${article.slice(0, 120000)}
"""

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
          "screenContent": "本步 hero：單一核心標語或一個列表項",
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

export const SCRIPT_SYSTEM_PROMPT = `你是經驗豐富的教授，為「Web Video Presentation」錄製口說。每個 step 對應 narrations 陣列中的一项。

硬性規則：
1. **一步一段口說**：每個 stepIndex 只寫該节拍口說，禁止在一步內念完「第一…第二…第三…」整份列表。
2. 口說比螢幕豐富：補充脈絡、定義、例子；禁止只複誦 screenContent。
3. 每步約 3~10 句（視 estimatedSeconds 調整），口語、無 markdown。
4. 善用 chapterInfoPool 與步級 infoPool。
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

為以下步驟撰寫口說（一步一段，列表已拆步）：
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
