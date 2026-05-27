import type { WvpChapterKind, WvpStepVisualPlan } from "@courseflow/core";

const FLOW_KW =
  /流程|步驟|迴圈|循环|Agent|Workflow|管線|管道|RAG|Tool|架構|链路|鏈路/i;
const LIST_KW = /三|四|五|六|七|八|九|十|第一|第二|第三|幾|几|項|项|點|点|清單|清单|特性|優勢|优势/i;

export function normalizeVizType(raw?: string): WvpChapterKind | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/_/g, "-");
  if (v.includes("list")) return "list-reveal";
  if (v.includes("flow") || v.includes("diagram") || v.includes("process")) return "flow";
  if (v.includes("hook") || v.includes("image")) return "hook";
  if (v.includes("magazine") || v.includes("quote")) return "magazine";
  return null;
}

export function inferChapterKind(opts: {
  chapterTitle?: string;
  narrations: string[];
  stepVisuals?: WvpStepVisualPlan[];
  planChapterKind?: string;
  preferFlow?: boolean;
}): WvpChapterKind {
  const fromPlan = normalizeVizType(opts.planChapterKind);
  if (fromPlan) return fromPlan;

  const vizVotes = (opts.stepVisuals ?? [])
    .map((s) => normalizeVizType(s.vizType))
    .filter(Boolean) as WvpChapterKind[];
  if (vizVotes.length > 0) {
    const flowCount = vizVotes.filter((v) => v === "flow").length;
    const listCount = vizVotes.filter((v) => v === "list-reveal").length;
    if (flowCount >= listCount && flowCount >= 2) return "flow";
    if (listCount >= 2) return "list-reveal";
  }

  const blob = `${opts.chapterTitle ?? ""} ${opts.narrations.join(" ")}`;
  const n = opts.narrations.length;

  if (FLOW_KW.test(blob) && n >= 3) return "flow";
  if (LIST_KW.test(blob) && n >= 4) return "list-reveal";
  if (opts.preferFlow && n >= 3) return "flow";
  if (n >= 5) return "list-reveal";
  if (n >= 3 && FLOW_KW.test(blob)) return "flow";
  return "magazine";
}
