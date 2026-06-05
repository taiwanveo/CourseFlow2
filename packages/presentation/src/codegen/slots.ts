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

/**
 * 畫面文字僅取自「文稿內容」的螢幕欄位。
 * 禁止以口播稿作為 fallback，避免把口播第一句（標點前片段）搬上螢幕。
 */
export function screenTextOnly(
  source: string | undefined,
  placeholder = "重點",
): string {
  const raw = compactSpaces(stripEllipsis(source ?? ""));
  return raw || placeholder;
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
): { intro: string; introSub: string; items: ListRevealItem[] } {
  if (narrations.length === 0) {
    return { intro: "本章", introSub: "", items: [] };
  }
  if (narrations.length === 1) {
    const introOnly = screenTextOnly(screenContents[0], "本章");
    const introParts = splitHeadlineForStaggeredReveal(introOnly, 2);
    return {
      intro: introParts[0] ?? introOnly,
      introSub: introParts[1] ?? "",
      items: [],
    };
  }
  const introSource = screenTextOnly(screenContents[0], "本章");
  const introParts = splitHeadlineForStaggeredReveal(introSource, 2);
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
): { intro: string; introSub: string; nodes: FlowNodeSlot[] } {
  if (narrations.length <= 1) {
    const single = screenTextOnly(screenContents[0], "流程");
    return {
      intro: single,
      introSub: "",
      nodes: narrations[0]
        ? [{ id: "n0", label: single, detail: single }]
        : [],
    };
  }
  const introSource = screenTextOnly(screenContents[0], "流程");
  const introParts = splitHeadlineForStaggeredReveal(introSource, 2);
  const intro = introParts[0] ?? introSource;
  const introSub = introParts[1] ?? "";
  const nodes = narrations.slice(1).map((_n, i) => {
    const screen = screenTextOnly(screenContents[i + 1], `步驟 ${i + 1}`);
    const parts = splitHeadlineForStaggeredReveal(screen, 2);
    return {
      id: `n${i}`,
      label: parts[0] ?? screen,
      detail: parts[1] ?? "",
    };
  });
  return { intro, introSub, nodes };
}
