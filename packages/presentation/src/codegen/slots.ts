export interface ListRevealItem {
  num: string;
  title: string;
  /** 畫面短語（非口播全文）；口播僅供音訊 */
  body: string;
  imageUrl?: string;
}

import { splitHeadlineForStaggeredReveal } from "./content-aware.js";

export interface FlowNodeSlot {
  id: string;
  label: string;
  detail: string;
}

function compactSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripEllipsis(text: string): string {
  return text.replace(/\.\.\.|…/g, "").trim();
}

function splitKeyPointPhrases(text: string): string[] {
  return compactSpaces(stripEllipsis(text))
    .split(/[／|｜，。！？；、,.!?;:：\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** 螢幕主標：1~3 個重點片語，禁止省略符號 */
export function screenHeadlineForSlot(
  source: string | undefined,
  maxChars = 56,
): string {
  const raw = compactSpaces(stripEllipsis(source ?? ""));
  if (!raw) return "";
  const parts = splitKeyPointPhrases(raw);
  const core = parts.length > 0 ? parts.slice(0, 3).join("／") : raw;
  if (core.length <= maxChars) return core;
  return core.slice(0, Math.max(8, maxChars)).trim();
}

/**
 * 清單格卡片標題：只取第一段關鍵詞，上限 14 字。
 */
export function screenLabelForItem(source: string | undefined): string {
  const MAX = 14;
  const raw = compactSpaces(stripEllipsis(source ?? ""));
  if (!raw) return "";
  const parts = splitKeyPointPhrases(raw);
  const sorted = [...parts].sort((a, b) => a.length - b.length);
  const best = sorted.find((p) => p.length <= MAX) ?? parts[0] ?? raw;
  return best.slice(0, MAX).trim();
}

const NARRATION_LEAK_ON_SCREEN =
  /第[一二三四五1-5]步|假[設设]|展示趨勢|看完成率|資料顯示|资料显示|口播|第三步|第二步|第一步|週完成率|周完成率|假設資料|假设资料/;

/** 剝除誤貼進螢幕欄的口播片段（第一步…、假設資料…） */
export function stripNarrationLeakFromScreen(text: string): string {
  let t = stripCraftMetadataFromScreen(text);
  if (!t) return "";
  const marker = t.search(NARRATION_LEAK_ON_SCREEN);
  if (marker > 0) t = t.slice(0, marker).trim();
  const first = t.split(/[。！？.!?；;]/)[0]?.trim() ?? "";
  if (first.length >= 2 && first.length <= 20) return first;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[0]!.length <= 12) return words[0]!;
  return t.length <= 16 ? t : t.slice(0, 16).trim();
}

/** 從 craft 後設描述中擷取「螢幕內容」引號內的真正標題 */
function extractQuotedScreenContent(text: string): string | null {
  const m = text.match(
    /(?:章節分隔頁的)?(?:螢幕|畫面|屏幕)(?:內容|文字)?(?:是|為)?[「『"]([^」』"]+)[」』"]/,
  );
  return m?.[1]?.trim() ?? null;
}

/** 剝除 AI 產碼／craft 上下文誤寫入螢幕欄的後設字串 */
export function stripCraftMetadataFromScreen(text: string): string {
  let t = compactSpaces(stripEllipsis(text));
  if (!t) return "";

  const quoted = extractQuotedScreenContent(t);
  if (quoted) return quoted;

  const narrationCut = t.search(/\s*口播稿(?:為|是|：|:)/);
  if (narrationCut > 0) t = t.slice(0, narrationCut).trim();

  const cutAt = t.search(/\s*章節：|【畫面\s*\d+】|\s*→\s*畫面：/);
  if (cutAt > 0) t = t.slice(0, cutAt).trim();

  const craftBlob =
    /章節分隔頁|口播稿(?:為|是)|【畫面\s*\d+】|→\s*畫面：|章節：/.test(t);
  let out = t
    .replace(/^章節分隔頁的(?:螢幕|畫面)內容(?:是|為)\s*/i, "")
    .replace(/\s*章節：[^\n【]+/g, "")
    .replace(/【畫面\s*\d+】/g, "")
    .replace(/\s*→\s*畫面：[^\n]+/g, "")
    .replace(/\s*口播稿(?:為|是|：|:).+$/i, "")
    .trim();
  if (craftBlob) {
    out = out
      .replace(
        /\s*[（(](?:Flow|Beat-Scene|Visual-Mix|節拍全屏|清單揭示|流程圖|list-reveal|Magazine|雜誌)[^）)]*[）)]\s*/gi,
        "",
      )
      .trim();
  }
  return out;
}

/**
 * 畫面文字：僅取自螢幕欄位，空白就空白，禁止占位符 fallback。
 */
export function screenTextOnly(source: string | undefined): string {
  const raw = stripCraftMetadataFromScreen(source ?? "");
  if (!raw) return "";
  if (raw.length > 72) return screenHeadlineForSlot(raw, 72);
  return raw;
}

/** @deprecated 請改用 screenTextOnly(source) */
export function verbatimScreenOrFallback(
  source: string | undefined,
  _fallback: string,
): string {
  return screenTextOnly(source);
}

/** 第 0 步為引子，其餘每步對應一個清單項 */
export function parseListRevealSlots(
  narrations: string[],
  screenContents: string[] = [],
): { intro: string; introSub: string; items: ListRevealItem[] } {
  if (narrations.length === 0) {
    return { intro: "", introSub: "", items: [] };
  }
  if (narrations.length === 1) {
    const introOnly = screenTextOnly(screenContents[0]);
    const hasExplicitIntroScreen = Boolean(screenContents[0]?.trim());
    const introParts = hasExplicitIntroScreen
      ? [introOnly]
      : splitHeadlineForStaggeredReveal(introOnly, 2);
    return {
      intro: introParts[0] ?? introOnly,
      introSub: introParts[1] ?? "",
      items: [],
    };
  }
  const introSource = screenTextOnly(screenContents[0]);
  const hasExplicitIntroScreen = Boolean(screenContents[0]?.trim());
  const introParts = hasExplicitIntroScreen
    ? [introSource]
    : splitHeadlineForStaggeredReveal(introSource, 2);
  const intro = introParts[0] ?? introSource;
  const introSub = introParts[1] ?? "";
  const items = narrations.slice(1).map((_n, i) => {
    const screen = screenTextOnly(screenContents[i + 1]);
    const hasScreen = Boolean(screenContents[i + 1]?.trim());
    if (hasScreen) {
      return {
        num: String(i + 1).padStart(2, "0"),
        title: screen,
        body: "",
      };
    }
    const parts = splitHeadlineForStaggeredReveal(screen, 2);
    return {
      num: String(i + 1).padStart(2, "0"),
      title: parts[0] ?? screen,
      body: parts[1] ?? "",
    };
  });
  return { intro, introSub, items };
}

/** 第 0 步為引子，其餘每步點亮一個流程節點 */
export function parseFlowSlots(
  narrations: string[],
  screenContents: string[] = [],
): { intro: string; introSub: string; nodes: FlowNodeSlot[] } {
  if (narrations.length <= 1) {
    const single = screenTextOnly(screenContents[0]);
    return {
      intro: single,
      introSub: "",
      nodes: narrations[0]
        ? [{ id: "n0", label: single, detail: single }]
        : [],
    };
  }
  const introSource = screenTextOnly(screenContents[0]);
  const introParts = splitHeadlineForStaggeredReveal(introSource, 2);
  const intro = introParts[0] ?? introSource;
  const introSub = introParts[1] ?? "";
  const nodes = narrations.slice(1).map((_n, i) => {
    const screen = screenTextOnly(screenContents[i + 1]);
    const colonMatch = screen.match(/^步驟\s*([一二三四五六七八九十\d]+)\s*[：:]\s*(.+)$/);
    if (colonMatch) {
      return {
        id: `n${i}`,
        label: `步驟 ${colonMatch[1]}`,
        detail: colonMatch[2]!.trim().slice(0, 48),
      };
    }
    const parts = splitHeadlineForStaggeredReveal(screen, 2);
    return {
      id: `n${i}`,
      label: screenLabelForItem(screen) || parts[0] || "",
      detail: parts[1] ?? "",
    };
  });
  return { intro, introSub, nodes };
}
