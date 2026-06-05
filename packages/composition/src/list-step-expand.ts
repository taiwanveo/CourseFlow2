import type { WvpChapterKind } from "@courseflow/core";
import type { GeneratedChapterInput } from "./outline.js";

const ORDINAL_RE =
  /(?:^|[，,；;\n])\s*(?:第\s*[一二三四五六七八九十\d]+[、.．：:]\s*|(?:[一二三四五六七八九十]+)[、.．：:]\s*)/g;

const NUMBERED_RE = /(?:^|\n)\s*(\d+)[.)．、]\s*/g;

function cleanItem(s: string): string {
  return s.replace(/^[\s、，,；;：:]+/, "").trim();
}

/** 從單一步驟文字拆出清單項（至少 2 項才視為清單） */
export function detectListItems(text: string): string[] | null {
  const t = text.trim();
  if (t.length < 12) return null;

  const byNumber: string[] = [];
  const numSplit = t.split(/(?=\d+[.)．、]\s+)/).map(cleanItem).filter((s) => s.length >= 4);
  if (numSplit.length >= 2) return numSplit.slice(0, 8);

  const ordinals = [...t.matchAll(ORDINAL_RE)];
  if (ordinals.length >= 2) {
    const parts: string[] = [];
    for (let i = 0; i < ordinals.length; i++) {
      const start = ordinals[i]!.index ?? 0;
      const end = i + 1 < ordinals.length ? (ordinals[i + 1]!.index ?? t.length) : t.length;
      parts.push(cleanItem(t.slice(start, end)));
    }
    const filtered = parts.filter((s) => s.length >= 4);
    if (filtered.length >= 2) return filtered.slice(0, 8);
  }

  const byLine = t
    .split(/\n+/)
    .map(cleanItem)
    .filter((s) => s.length >= 4 && s.length <= 120);
  if (byLine.length >= 2) return byLine.slice(0, 8);

  const bySemi = t
    .split(/[；;](?=\s*[^\s])/)
    .map(cleanItem)
    .filter((s) => s.length >= 6 && s.length <= 100);
  if (bySemi.length >= 2) return bySemi.slice(0, 8);

  return null;
}

function listIntroFromText(text: string, items: string[]): string {
  const first = items[0] ?? "";
  const idx = text.indexOf(first);
  if (idx > 8) return text.slice(0, idx).trim().replace(/[：:，,、]\s*$/, "");
  const m = text.match(/(.{0,40}(?:三|四|五|六|七|八|九|十|幾|几).{0,20})/);
  return m?.[1]?.trim() || text.slice(0, 36).trim();
}

export function expandListItemsInStep(step: GeneratedChapterInput["steps"][number]): GeneratedChapterInput["steps"] {
  // 只用 screenContent 偵測清單；script 是口播稿，不納入清單展開邏輯
  const blob = step.screenContent;
  const items = detectListItems(blob);
  if (!items || items.length < 2) return [step];

  const intro = listIntroFromText(blob, items);
  const introStep: GeneratedChapterInput["steps"][number] = {
    screenContent: intro || step.screenContent.slice(0, 48),
    infoPool: step.infoPool?.length ? step.infoPool : [intro],
    estimatedSeconds: step.estimatedSeconds ?? 6,
    script: intro || step.script,
  };

  return [
    introStep,
    ...items.map((item) => ({
      screenContent: item.slice(0, 48),
      infoPool: [item],
      estimatedSeconds: step.estimatedSeconds ?? 10,
      script: item,
    })),
  ];
}

const FLOW_HINT =
  /流程|步驟|阶段|階段|管線|管道|架構|链路|鏈路|迴圈|循环|Agent|Workflow|RAG|然後|接著|接下來/i;
const LIST_HINT =
  /清單|清单|條列|条列|優勢|优势|痛點|痛点|特性|要點|要点|第一|第二|第三|其一|其二/i;

export function inferChapterKindFromSteps(steps: GeneratedChapterInput["steps"]): WvpChapterKind | undefined {
  const n = steps.length;
  if (n < 3) return undefined;
  const blob = steps.map((s) => `${s.screenContent} ${s.script ?? ""}`).join(" ");
  const flowScore = FLOW_HINT.test(blob) ? 2 : 0;
  const listScore = LIST_HINT.test(blob) ? 2 : 0;
  if (flowScore > listScore) return "flow";
  if (listScore > 0 || n >= 4) return "list-reveal";
  if (n >= 3) return "list-reveal";
  return undefined;
}

/** 內容生成後：清單型單步拆成「引子 + 每項一步」 */
export function expandListStepsInGeneratedChapters(
  chapters: GeneratedChapterInput[],
): GeneratedChapterInput[] {
  return chapters.map((ch) => {
    if (ch.chapterKind === "hook") return ch;

    const expanded: GeneratedChapterInput["steps"] = [];
    for (const st of ch.steps) {
      expanded.push(...expandListItemsInStep(st));
    }

    const wasList = expanded.length > ch.steps.length;
    return {
      ...ch,
      steps: expanded,
      chapterKind:
        ch.chapterKind ??
        (wasList ? "list-reveal" : inferChapterKindFromSteps(expanded)),
    };
  });
}
