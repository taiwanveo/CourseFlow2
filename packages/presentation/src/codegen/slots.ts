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

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
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
    return { intro: narrations[0] ?? "本章", introSub: "", items: [] };
  }
  const n0 = narrations[0] ?? "";
  const intro = screenContents[0]?.trim() || truncate(n0, 32);
  const introSub = screenContents[0]?.trim() ? truncate(screenContents[0], 40) : "";
  const items = narrations.slice(1).map((n, i) => ({
    num: String(i + 1).padStart(2, "0"),
    title: screenContents[i + 1]?.trim() || truncate(n, 28),
    body: screenContents[i + 1]?.trim()
      ? truncate(screenContents[i + 1]!, 56)
      : "",
  }));
  return { intro, introSub, items };
}

/** 第 0 步為引子，其餘每步點亮一個流程節點 */
export function parseFlowSlots(
  narrations: string[],
  screenContents: string[] = [],
): { intro: string; nodes: FlowNodeSlot[] } {
  if (narrations.length <= 1) {
    return {
      intro: narrations[0] ?? "流程",
      nodes: narrations[0]
        ? [{ id: "n0", label: truncate(narrations[0], 16), detail: narrations[0] }]
        : [],
    };
  }
  const n0 = narrations[0] ?? "";
  const intro = screenContents[0]?.trim() || truncate(n0, 36);
  const nodes = narrations.slice(1).map((n, i) => ({
    id: `n${i}`,
    label: screenContents[i + 1]?.trim() || truncate(n, 18),
    detail: screenContents[i + 1]?.trim()
      ? truncate(screenContents[i + 1]!, 48)
      : "",
  }));
  return { intro, nodes };
}
