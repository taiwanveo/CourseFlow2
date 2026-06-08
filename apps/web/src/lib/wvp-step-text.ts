/**
 * WVP 步驟文字唯一來源（Single Source of Truth）
 *
 * 規則（不可違反）：
 * - 螢幕內容（screenContent）→ 只供畫面 TSX / 模板 codegen
 * - 口播稿（script）→ 只供 narrations.ts → SubtitleBar 字幕
 * 兩者禁止互相 fallback。
 *
 * 此檔必須保持純函式、無 node:* 匯入（Client Component 會間接引用）。
 */
import type { CompositionStep } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";

function compactSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripEditorChapterLabel(text: string): string {
  return compactSpaces(text.replace(/^【章節】\s*/, "").replace(/\.\.\.|…/g, ""));
}

/** 剝除 craft 後設字串；不碰口播稿語意 */
export function stripCraftMetaFromScreen(raw: string): string {
  let t = compactSpaces(raw.replace(/\.\.\.|…/g, ""));
  if (!t) return "";
  const quoted = t.match(
    /(?:章節分隔頁的)?(?:螢幕|畫面|屏幕)(?:內容|文字)?(?:是|為)?[「『"]([^」』"]+)[」』"]/,
  );
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const narrationCut = t.search(/\s*口播稿(?:為|是|：|:)/);
  if (narrationCut > 0) t = t.slice(0, narrationCut).trim();
  return t
    .replace(/^章節分隔頁的(?:螢幕|畫面)內容(?:是|為)\s*/i, "")
    .replace(/\s*口播稿(?:為|是|：|:).+$/i, "")
    .trim();
}

/** 剝除誤寫進 script 欄的 craft 標籤（口播稿為／螢幕內容是…） */
export function stripCraftMetaFromScript(raw: string): string {
  let t = compactSpaces(raw.replace(/\.\.\.|…/g, ""));
  if (!t) return "";
  t = t.replace(/^口播稿(?:為|是|：|:)\s*/i, "");
  const screenLeak = t.search(
    /(?:章節分隔頁的)?(?:螢幕|畫面|屏幕)內容(?:是|為)|章節分隔頁的(?:螢幕|畫面)/,
  );
  if (screenLeak > 0) t = t.slice(0, screenLeak).trim();
  return t.replace(/\s*口播稿(?:為|是|：|:).+$/i, "").trim();
}

/** 口播稿：僅 script，禁止用 screenContent 補位 */
export function narrationTextForStep(step: CompositionStep): string {
  return stripCraftMetaFromScript(step.script ?? "");
}

/**
 * 螢幕內容：僅 screenContent（章節分隔步空白時才用章節標題）。
 * 禁止用 script 或口播片段當畫面文字。
 */
export function screenTextForStep(step: CompositionStep, chapterTitle: string): string {
  const stripped = stripCraftMetaFromScreen(step.screenContent ?? "");
  if (isChapterStep(step)) {
    const custom = stripEditorChapterLabel(stripped);
    if (custom) return custom;
    return chapterTitle.trim();
  }
  return stripped;
}
