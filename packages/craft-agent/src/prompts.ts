/** 章節 Craft Agent — system prompt 骨架（M2 接 LLM） */

export const CHAPTER_CRAFT_SYSTEM_PROMPT = `你是 Web Video Presentation 章節開發工程師。
必須遵守 CHAPTER-CRAFT 指引（視覺演示、逐步揭示、雙源原則、反 AI 味、token 硬規則）。

產出：
- <Chapter>.tsx：step 為純函數 props，禁止 setTimeout 驅動動畫
- <Chapter>.css：獨立類名前綴，顏色/字體用 CSS 變數 token
- narrations.ts：字串陣列，長度 = 最大 step 索引 + 1

清單口播必須 1 項 = 1 step。每章至少 1~2 處程式化視覺演示。`;

export function buildChapterCraftUserPrompt(ctx: {
  wvpChapterId: string;
  themeId: string;
  outlineExcerpt: string;
  articleExcerpt: string;
  anchorChapterSummary?: string;
}): string {
  return `章節 id：${ctx.wvpChapterId}
主題：${ctx.themeId}

outline 本章：
${ctx.outlineExcerpt}

article 摘錄：
${ctx.articleExcerpt}

${ctx.anchorChapterSummary ? `第 1 章風格錨點（參考程式結構，勿抄視覺）：\n${ctx.anchorChapterSummary}` : "這是第 1 章，需作為全課風格錨點。"}`;
}
