import type { WvpChapterKind, WvpStepVisualPlan } from "@courseflow/core";
import { scoreFlowSignals, scoreListSignals } from "./content-aware.js";

const FLOW_KW =
  /流程|步驟|迴圈|循环|Agent|Workflow|管線|管道|RAG|Tool|架構|链路|鏈路|階段|阶段|串接|從.*到/i;
const LIST_KW =
  /三|四|五|六|七|八|九|十|第一|第二|第三|第四|第五|幾|几|項|项|點|点|清單|清单|特性|優勢|优势|痛點|痛点|要點|要点|條列|条列/i;
/** 數據／圖表章節：應走 Visual-Mix，不宜推斷為 flow */
const DATA_VISUAL_KW =
  /數據視覺|数据视觉|圖表動畫|图表动画|圖表實驗|完成率|營收.*曲線|营收.*曲线|成長曲線|成长曲线|方案對比|方案对比|三種方案|季度.*成長|折線圖|折线图|趨勢|趋势/i;

export function isDataVisualChapter(opts: {
  chapterTitle?: string;
  narrations: string[];
  screenContents?: string[];
}): boolean {
  const blob = `${opts.chapterTitle ?? ""} ${opts.narrations.join(" ")} ${(opts.screenContents ?? []).join(" ")}`;
  return DATA_VISUAL_KW.test(blob);
}

export function normalizeVizType(raw?: string): WvpChapterKind | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/_/g, "-");
  if (v.includes("list")) return "list-reveal";
  if (v.includes("flow") || v.includes("diagram") || v.includes("process")) return "flow";
  if (v.includes("hook") || v.includes("image") || v.includes("coldopen") || v.includes("intro")) {
    return "hook";
  }
  if (v.includes("magazine") || v.includes("quote") || v.includes("outro")) return "magazine";
  if (v === "custom") return "custom";
  return null;
}

export function inferChapterKind(opts: {
  chapterTitle?: string;
  narrations: string[];
  stepVisuals?: WvpStepVisualPlan[];
  planChapterKind?: string;
  preferFlow?: boolean;
  screenContents?: string[];
}): WvpChapterKind {
  const title = opts.chapterTitle ?? "";
  const narrations = opts.narrations;
  const n = narrations.length;
  const blob = `${title} ${narrations.join(" ")} ${(opts.screenContents ?? []).join(" ")}`;
  const dataVisual = isDataVisualChapter({
    chapterTitle: title,
    narrations,
    screenContents: opts.screenContents,
  });

  /** 數據視覺章：不走 flow/list；實際畫面由 visual-mix + stepVisualConfigs 決定 */
  if (dataVisual && n >= 2) {
    return "magazine";
  }

  const fromPlan = normalizeVizType(opts.planChapterKind);
  if (fromPlan && fromPlan !== "magazine") return fromPlan;

  const vizVotes = (opts.stepVisuals ?? [])
    .map((s) => normalizeVizType(s.vizType))
    .filter(Boolean) as WvpChapterKind[];
  if (vizVotes.length > 0) {
    const flowCount = vizVotes.filter((v) => v === "flow").length;
    const listCount = vizVotes.filter((v) => v === "list-reveal").length;
    if (flowCount > listCount && flowCount >= 2) return "flow";
    if (listCount >= 2) return "list-reveal";
  }

  if (/開場|前言|冷開|coldopen|intro/i.test(blob) && n <= 2) return "hook";
  if (/結語|結束|outro|conclusion/i.test(title) && n <= 2) return "magazine";

  let listScore = scoreListSignals(title, narrations);
  let flowScore = scoreFlowSignals(title, narrations);
  if (FLOW_KW.test(blob)) flowScore += 2;
  if (LIST_KW.test(blob)) listScore += 2;

  if (opts.preferFlow && n >= 3 && flowScore >= 1) return "flow";

  if (flowScore > listScore && flowScore >= 2 && n >= 3) return "flow";
  if (listScore >= 2 && n >= 3) return "list-reveal";
  if (FLOW_KW.test(blob) && n >= 3) return "flow";
  if (LIST_KW.test(blob) && n >= 3) return "list-reveal";

  // 多步驟章節預設走結構化版型，避免落到 magazine
  if (n >= 5) return "list-reveal";
  if (n >= 4) return listScore >= flowScore ? "list-reveal" : "flow";
  if (n >= 3) return flowScore > listScore ? "flow" : "list-reveal";
  if (n === 2) {
    if (flowScore > listScore) return "flow";
    if (listScore > 0) return "list-reveal";
  }

  return "magazine";
}
