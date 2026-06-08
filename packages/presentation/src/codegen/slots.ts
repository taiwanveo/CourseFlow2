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
  fallback: string,
  maxChars = 56,
): string {
  const raw = compactSpaces(stripEllipsis(source ?? ""));
  if (!raw) return fallback;
  const parts = splitKeyPointPhrases(raw);
  const core = parts.length > 0 ? parts.slice(0, 3).join("／") : raw;
  if (core.length <= maxChars) return core;
  return core.slice(0, Math.max(8, maxChars)).trim();
}

/**
 * 清單格卡片標題：只取第一段關鍵詞，上限 14 字。
 * 當 screenContents 未提供而 fallback 為 narration 全文時，
 * 自動萃取第一個片語避免把口說稿搬到畫面上。
 */
export function screenLabelForItem(
  source: string | undefined,
  fallback: string,
): string {
  const MAX = 14;
  const raw = compactSpaces(stripEllipsis(source ?? ""));
  if (!raw) return fallback;
  const parts = splitKeyPointPhrases(raw);
  // 優先取最短的那段（通常是真正的關鍵詞），不超過 MAX 字
  const sorted = [...parts].sort((a, b) => a.length - b.length);
  const best = sorted.find((p) => p.length <= MAX) ?? parts[0] ?? raw;
  return best.slice(0, MAX).trim();
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

function sanitizeScreenLabel(text: string | undefined, fallback: string, max: number): string {
  return screenHeadlineForSlot(text, fallback, max);
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

  return t
    .replace(/^章節分隔頁的(?:螢幕|畫面)內容(?:是|為)\s*/i, "")
    .replace(/\s*章節：[^\n【]+/g, "")
    .replace(/【畫面\s*\d+】/g, "")
    .replace(/\s*→\s*畫面：[^\n]+/g, "")
    .replace(/\s*口播稿(?:為|是|：|:).+$/i, "")
    .replace(
      /\s*[（(](?:Flow|Beat-Scene|Visual-Mix|節拍全屏|清單揭示|流程圖|list-reveal|Magazine|雜誌)[^）)]*[）)]\s*/gi,
      "",
    )
    .trim();
}

/**
 * 畫面文字僅取自「文稿內容」的螢幕欄位。
 * 禁止以口播稿作為 fallback，避免把口播第一句（標點前片段）搬上螢幕。
 */
export function screenTextOnly(
  source: string | undefined,
  placeholder = "重點",
): string {
  const raw = stripCraftMetadataFromScreen(source ?? "");
  if (!raw) return placeholder;
  if (raw.length > 48) return screenHeadlineForSlot(raw, placeholder, 48);
  return raw;
}

/** @deprecated 請改用 screenTextOnly；保留相容，但不再接受口播稿作 fallback */
export function verbatimScreenOrFallback(
  source: string | undefined,
  fallback: string,
): string {
  return screenTextOnly(source, fallback === "本章" || fallback === "重點" ? fallback : "重點");
}

/** 第 0 步為引子，其餘每步對應一個清單項 */
export function parseListRevealSlots(
  narrations: string[],
  screenContents: string[] = [],
  introFallback = "本章",
): { intro: string; introSub: string; items: ListRevealItem[] } {
  const introPlaceholder = introFallback.trim() || "本章";
  if (narrations.length === 0) {
    return { intro: introPlaceholder, introSub: "", items: [] };
  }
  if (narrations.length === 1) {
    const introOnly = screenTextOnly(screenContents[0], introPlaceholder);
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
  const introSource = screenTextOnly(screenContents[0], introPlaceholder);
  const hasExplicitIntroScreen = Boolean(screenContents[0]?.trim());
  const introParts = hasExplicitIntroScreen
    ? [introSource]
    : splitHeadlineForStaggeredReveal(introSource, 2);
  const intro = introParts[0] ?? introSource;
  const introSub = introParts[1] ?? "";
  const items = narrations.slice(1).map((_n, i) => {
    const screen = screenTextOnly(screenContents[i + 1], `重點 ${i + 1}`);
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
  introFallback = "流程",
): { intro: string; introSub: string; nodes: FlowNodeSlot[] } {
  const introPlaceholder = introFallback.trim() || "流程";
  if (narrations.length <= 1) {
    const single = screenTextOnly(screenContents[0], introPlaceholder);
    return {
      intro: single,
      introSub: "",
      nodes: narrations[0]
        ? [{ id: "n0", label: single, detail: single }]
        : [],
    };
  }
  const introSource = screenTextOnly(screenContents[0], introPlaceholder);
  const introParts = splitHeadlineForStaggeredReveal(introSource, 2);
  const intro = introParts[0] ?? introSource;
  const introSub = introParts[1] ?? "";
  const nodes = narrations.slice(1).map((_n, i) => {
    const screen = screenTextOnly(screenContents[i + 1], `步驟 ${i + 1}`);
    const stepTag = `步驟 ${i + 1}`;
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
      label: screenLabelForItem(screen, stepTag),
      detail: parts[1] ?? "",
    };
  });
  return { intro, introSub, nodes };
}
