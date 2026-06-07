import type { DesignTokens } from "../tokens/theme-bridge.js";
import { withAsianSlideDesignContext } from "@courseflow/core";

export function buildVisualDirectorSystemPrompt(theme: DesignTokens): string {
  return withAsianSlideDesignContext(`你是「簡報視覺導演、動態插圖設計師、教學設計顧問」。

我會提供每一頁的：
1. 投影片螢幕文字
2. 該頁口播稿

你的任務不是重複文字，而是：
- 理解每頁核心教學重點
- 判斷最適合的簡報輔助插圖或動態視覺
- 避免與螢幕文字重複的圖片
- 幫助觀眾理解抽象概念、流程、關係、風險、對比或情境
- 設計服務教學的動態效果（不要炫技）
- 產出可供 AI 生圖 / 動畫 / 前端渲染使用的結構化計畫

【當前簡報主題】
- 字型風格：${theme.font.label}
- 風格關鍵字：${theme.moods.join("、") || "通用"}
- 模式：${theme.darkMode ? "深色" : "淺色"}
- 主色調：${theme.colors.primary}
- 輔色：${theme.colors.secondary}
- 強調色：${theme.colors.accent}
- 背景色：${theme.colors.surface}
- 文字色：${theme.colors.text}
所有 imagePromptEn / animationPromptEn 建議的視覺元素，配色應與上述主題 token 保持一致。

【recommendedOutput 決策】
- ai-image：適合情境插圖、概念隱喻、人物互動、風險警示等「單張輔助圖」
- chart：有可比較數值、趨勢、比例、KPI
- table：多方案/多屬性對照、評估取捨
- animation：流程步驟、重點條列、單句強調（process-flow / reveal-list / callout）
- none：極少使用；CourseFlow 每步至少一個視覺元素，僅當版面已有大圖/圖表/清單格且再加會噪音時才填 skipReason

【原則】
- 不要把口播整段放進圖中；圖中文字應極少或零
- 優先易懂的視覺隱喻，不要複雜裝飾
- 每一頁風格一致
- 避免過度科技感、過度抽象、過度雜亂
- 若更適合圖表/流程動畫而非 AI 圖，請明確選 chart/table/animation，不要選 ai-image
- imagePromptEn / animationPromptEn 用英文；animationPromptZh 用繁體中文

只回傳一個 JSON 物件（不要 Markdown），欄位如下：
{
  "screenSummary": "螢幕文字重點摘要",
  "scriptSummary": "口播稿重點摘要",
  "coreMessage": "這頁真正要傳達的核心訊息",
  "visualType": "scenario|flow|data-flow|architecture|contrast|risk|timeline|metaphor|infographic|interaction|none",
  "recommendedOutput": "ai-image|chart|table|animation|none",
  "sceneDescription": "建議畫面描述（主體、構圖、背景、視覺焦點）",
  "motionEffect": "建議動態效果（如：節點連線逐步亮起、左右對比逐步揭示）",
  "imagePromptEn": "給 AI 圖片工具的英文 prompt（若 recommendedOutput 不是 ai-image 可留空字串）",
  "animationPromptEn": "給 AI 動畫工具的英文 prompt",
  "animationPromptZh": "動畫 prompt 中文說明",
  "avoidElements": ["不建議出現的元素1", "..."],
  "layoutIntegration": "簡報整合建議（位置、與文字搭配、背景/插圖/側邊）",
  "skipReason": "若 recommendedOutput 為 none，說明原因；否則可省略"
}`);
}

export function buildVisualDirectorBatchUserPrompt(opts: {
  courseTopic: string;
  narrations: string[];
  screenContents: string[];
  articleSnippet?: string;
}): string {
  const blocks = opts.narrations.map((script, step) => {
    const screen = (opts.screenContents[step] ?? "").trim();
    const narration = script.trim();
    return [
      `--- 步驟 ${step} ---`,
      screen ? `螢幕文字：\n${screen.slice(0, 800)}` : "螢幕文字：（無）",
      narration ? `口播稿：\n${narration.slice(0, 1200)}` : "口播稿：（無）",
    ].join("\n");
  });

  return [
    `課程主題：${opts.courseTopic.trim() || "教學課程"}`,
    opts.articleSnippet?.trim()
      ? `章節摘錄：\n${opts.articleSnippet.trim().slice(0, 600)}`
      : "",
    "以下為本章各步驟內容：",
    blocks.join("\n\n"),
    `請為每個步驟（step 0 到 ${opts.narrations.length - 1}）各輸出一筆 director 計畫。`,
    '只回傳 JSON：{ "steps": [ { "step": 0, "screenSummary": "...", "scriptSummary": "...", "coreMessage": "...", "visualType": "...", "recommendedOutput": "ai-image|chart|table|animation|none", "sceneDescription": "...", "motionEffect": "...", "imagePromptEn": "", "animationPromptEn": "", "animationPromptZh": "", "avoidElements": [], "layoutIntegration": "...", "skipReason": "..." } ] }',
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildVisualConfigBatchSystemPrompt(theme: DesignTokens): string {
  return `${buildVisualDirectorSystemPrompt(theme)}

你現在要為多個步驟一次產出 chart / table / animation 的 VisualConfig JSON。
每筆 config 必須通過 schema：kind 為 chart|table|animation，並含 step 欄位（0-based）。`;
}

export function buildVisualConfigBatchUserPrompt(opts: {
  narrations: string[];
  screenContents: string[];
  articleSnippet?: string;
  directorSteps: Array<{ step: number; plan: { recommendedOutput: string; coreMessage?: string } }>;
}): string {
  const blocks = opts.directorSteps.map((entry) => {
    const step = entry.step;
    return [
      `--- 步驟 ${step}（${entry.plan.recommendedOutput}）---`,
      `核心訊息：${entry.plan.coreMessage ?? ""}`,
      `螢幕：${(opts.screenContents[step] ?? "").slice(0, 400)}`,
      `口播：${(opts.narrations[step] ?? "").slice(0, 600)}`,
    ].join("\n");
  });

  return [
    opts.articleSnippet?.trim() ? `章節摘錄：\n${opts.articleSnippet.slice(0, 400)}` : "",
    "請為以下步驟各產出一筆 VisualConfig：",
    blocks.join("\n\n"),
    '只回傳 JSON：{ "configs": [ { "step": 0, "kind": "chart", ... } ] }',
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildVisualDirectorUserPrompt(opts: {
  stepIndex: number;
  courseTopic: string;
  screenContent: string;
  stepScript: string;
  articleSnippet?: string;
}): string {
  const screen = opts.screenContent.trim();
  const script = opts.stepScript.trim();
  return [
    `【第 ${opts.stepIndex + 1} 頁】`,
    `課程主題：${opts.courseTopic.trim() || "教學課程"}`,
    screen ? `螢幕文字：\n${screen.slice(0, 800)}` : "螢幕文字：（無）",
    script ? `口播稿：\n${script.slice(0, 1200)}` : "口播稿：（無）",
    opts.articleSnippet?.trim()
      ? `章節摘錄：\n${opts.articleSnippet.trim().slice(0, 600)}`
      : "",
    "請輸出上述 JSON 計畫。",
  ]
    .filter(Boolean)
    .join("\n\n");
}
