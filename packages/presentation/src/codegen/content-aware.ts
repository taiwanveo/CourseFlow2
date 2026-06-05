import type { WvpChapterKind } from "@courseflow/core";

export type StepMotion = {
  enterAnimationId: string;
  transitionId: string;
};

const LIST_ITEM_RE =
  /第[一二三四五六七八九十\d]+|首先|其次|再者|另外|最後|一是|二是|三是|四是|五是|其一|其二|其三|包括|分為|分成|種|個方面|項重點|大優勢|大痛點|清單|條列/i;
const FLOW_ITEM_RE =
  /然後|接著|接下來|之後|最後一步|流程|步驟|階段|先.*再|從.*到|串接|管線|鏈路|链路|迴圈|循环|Agent|Workflow/i;
const CONTRAST_RE = /對比|对比|差異|相比|另一方面|相對|vs|VS|優於|劣於/i;
const METRIC_RE = /\d+%|百分之|倍|成長|遞增|递减|計數|數字|從\s*0/i;
const HOOK_RE = /開場|前言|冷開|coldopen|intro|歡迎|大家好/i;

function compactSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 把主標拆成 2 段，供 MaskReveal 分段揭示（類似 demo TraditionalPain） */
export function splitHeadlineForStaggeredReveal(text: string, maxParts = 2): string[] {
  const raw = compactSpaces(text);
  if (!raw) return [];
  const byPunct = raw
    .split(/[／|｜，。！？；、:：]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byPunct.length >= 2) return byPunct.slice(0, maxParts);

  const commaParts = raw
    .split(/[，,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length >= 2) return commaParts.slice(0, maxParts);

  if (raw.length > 14) {
    const pivot = Math.min(
      raw.search(/[，,。！？；、:：]/),
      raw.length > 20 ? 12 : 10,
    );
    if (pivot > 4 && pivot < raw.length - 4) {
      return [raw.slice(0, pivot).trim(), raw.slice(pivot).replace(/^[，,。！？；、\s]+/, "").trim()].filter(
        Boolean,
      );
    }
  }
  return [raw];
}

export function scoreListSignals(chapterTitle: string, narrations: string[]): number {
  let score = 0;
  const blob = `${chapterTitle} ${narrations.join(" ")}`;
  if (/清單|清单|條列|条列|優勢|优势|痛點|痛点|特性|要點|要点|三|四|五|六|七|八|九|十/.test(blob)) {
    score += 2;
  }
  for (const n of narrations) {
    if (LIST_ITEM_RE.test(n)) score += 2;
    if (/^[-*•\d]+[.)）、\s]/.test(n.trim())) score += 2;
  }
  if (narrations.length >= 5) score += 2;
  else if (narrations.length >= 4) score += 1;
  else if (narrations.length >= 3) score += 1;
  return score;
}

export function scoreFlowSignals(chapterTitle: string, narrations: string[]): number {
  let score = 0;
  const blob = `${chapterTitle} ${narrations.join(" ")}`;
  if (/流程|步驟|阶段|階段|管線|管道|架構|链路|鏈路|迴圈|循环|Agent|Workflow|RAG|Tool/i.test(blob)) {
    score += 2;
  }
  for (const n of narrations) {
    if (FLOW_ITEM_RE.test(n)) score += 2;
  }
  if (narrations.length >= 4) score += 1;
  return score;
}

export function pickContentAwareStepMotion(
  stepIndex: number,
  screenContent: string,
  narration: string,
  chapterKind: WvpChapterKind,
): StepMotion {
  if (stepIndex === 0) {
    return { enterAnimationId: "scale-in", transitionId: "crossfade" };
  }

  const blob = `${screenContent} ${narration}`;
  if (CONTRAST_RE.test(blob)) {
    return {
      enterAnimationId: stepIndex % 2 === 0 ? "slide-left" : "slide-right",
      transitionId: "crossfade",
    };
  }
  if (METRIC_RE.test(blob)) {
    return { enterAnimationId: "drop-in", transitionId: "crossfade" };
  }
  if (chapterKind === "flow") {
    return {
      enterAnimationId: stepIndex % 2 === 0 ? "wipe-up" : "rise-soft",
      transitionId: "crossfade",
    };
  }
  if (chapterKind === "list-reveal") {
    const cycle = ["fade-up", "slide-left", "blur-in", "wipe-up", "drop-in", "overshoot"];
    return {
      enterAnimationId: cycle[(stepIndex - 1) % cycle.length] ?? "fade-up",
      transitionId: "crossfade",
    };
  }
  if (/強調|關鍵|核心|重點|金句/.test(blob)) {
    return { enterAnimationId: "blur-in", transitionId: "crossfade" };
  }
  return {
    enterAnimationId: stepIndex % 2 === 0 ? "fade-up" : "slide-left",
    transitionId: "crossfade",
  };
}

export function makeContentAwareStepMotions(
  narrations: string[],
  screenContents: string[],
  chapterKind: WvpChapterKind,
): StepMotion[] {
  return narrations.map((narration, stepIndex) =>
    pickContentAwareStepMotion(
      stepIndex,
      screenContents[stepIndex] ?? "",
      narration,
      chapterKind,
    ),
  );
}
