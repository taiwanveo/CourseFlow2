export interface ListRevealItem {
  num: string;
  title: string;
  /** 畫面短語（非口播全文）；口播僅供音訊 */
  body: string;
  imageUrl?: string;
}

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

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

function sanitizeScreenLabel(text: string | undefined, fallback: string, max: number): string {
  return screenHeadlineForSlot(text, fallback, max);
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
    return {
      intro: sanitizeScreenLabel(screenContents[0], "本章", 20),
      introSub: "",
      items: [],
    };
  }
  const intro = screenHeadlineForSlot(screenContents[0], "本章重點", 56);
  const introSub = "";
  const items = narrations.slice(1).map((n, i) => ({
    num: String(i + 1).padStart(2, "0"),
    title: screenHeadlineForSlot(screenContents[i + 1], `重點 ${i + 1}`, 48),
    body: "",
  }));
  return { intro, introSub, items };
}

/** 第 0 步為引子，其餘每步點亮一個流程節點 */
export function parseFlowSlots(
  narrations: string[],
  screenContents: string[] = [],
): { intro: string; nodes: FlowNodeSlot[] } {
  if (narrations.length <= 1) {
    const single = sanitizeScreenLabel(screenContents[0], "流程", 20);
    return {
      intro: single,
      nodes: narrations[0]
        ? [{ id: "n0", label: single, detail: single }]
        : [],
    };
  }
  const intro = screenHeadlineForSlot(screenContents[0], "流程總覽", 48);
  const nodes = narrations.slice(1).map((n, i) => ({
    id: `n${i}`,
    label: screenHeadlineForSlot(screenContents[i + 1], `節點 ${i + 1}`, 40),
    detail: "",
  }));
  return { intro, nodes };
}
