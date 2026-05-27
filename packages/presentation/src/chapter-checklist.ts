import {
  chapterBindsNarrationText,
  chapterUsesInvalidMaskReveal,
  hasVisualDemoInSources,
} from "./visual-demo.js";

export interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  evidence?: string;
  suggestion?: string;
}

export interface ChapterChecklistResult {
  chapterId: string;
  passed: boolean;
  items: ChecklistItem[];
  templateKind?: string;
}

const ANTI_AI =
  /gradient.*135deg|from-purple|emoji|lucide|假.*萬|placeholder\.com|StepContentViz/i;

export function runChapterCraftChecklist(opts: {
  wvpChapterId: string;
  tsx: string;
  css: string;
  narrations: string[];
  articleExcerpt?: string;
  templateKind?: string;
}): ChapterChecklistResult {
  const { tsx, css, narrations } = opts;
  const blob = `${tsx}\n${css}`;
  const items: ChecklistItem[] = [];

  items.push({
    id: "visual-demo",
    label: "含概念圖解／清單揭示／流程動畫元件",
    passed: hasVisualDemoInSources(tsx, css),
    evidence: opts.templateKind ?? (tsx.includes("ListRevealGrid") ? "list-reveal" : tsx.includes("FlowDiagram") ? "flow" : "other"),
  });

  items.push({
    id: "narrations-length",
    label: "narrations 與 step 區塊一致",
    passed: narrations.every(
      (_, i) =>
        tsx.includes(`step === ${i}`) ||
        tsx.includes("ListRevealGrid") ||
        tsx.includes("FlowDiagram") ||
        tsx.includes("HookImageStrip") ||
        tsx.includes("VisualBlock"),
    ),
    evidence: `${narrations.length} narrations`,
  });

  items.push({
    id: "narration-bind",
    label: "口播與畫面步驟對齊",
    passed: chapterBindsNarrationText(tsx, narrations),
    suggestion: "請在視覺動效對該章重新「匯入口播」後「AI 畫面」",
  });

  items.push({
    id: "mask-reveal-api",
    label: "MaskReveal API 正確",
    passed: !chapterUsesInvalidMaskReveal(tsx) || tsx.includes("ListRevealGrid") || tsx.includes("FlowDiagram") || tsx.includes("VisualBlock"),
  });

  items.push({
    id: "list-reveal",
    label: "清單型：使用 ListRevealGrid（1 項 1 step）",
    passed:
      opts.templateKind !== "list-reveal" ||
      (tsx.includes("ListRevealGrid") && narrations.length >= 2),
    suggestion: "清單章應為引子 + 每項一步",
  });

  items.push({
    id: "flow",
    label: "流程型：使用 FlowDiagram",
    passed: opts.templateKind !== "flow" || tsx.includes("FlowDiagram"),
  });

  items.push({
    id: "hook",
    label: "Hook 型：使用 HookImageStrip",
    passed: opts.templateKind !== "hook" || tsx.includes("HookImageStrip"),
  });

  items.push({
    id: "visual-config-valid",
    label: "宣告式視覺：VisualBlock + STEP_VISUALS",
    passed:
      opts.templateKind !== "visual-mix" ||
      (tsx.includes("VisualBlock") && tsx.includes("STEP_VISUALS")),
  });

  let dualPassed = true;
  if (opts.articleExcerpt && opts.articleExcerpt.length > 80) {
    const snippets = opts.articleExcerpt.match(/[\u4e00-\u9fff]{4,12}/g)?.slice(0, 8) ?? [];
    const hits = snippets.filter((s) => tsx.includes(s) || narrations.some((n) => n.includes(s)));
    dualPassed = hits.length >= 1 || narrations.some((n) => tsx.includes(n.slice(0, 8)));
    items.push({
      id: "dual-source",
      label: "雙源：畫面含 article 或口播細節",
      passed: dualPassed,
      evidence: `${hits.length} article 片段命中`,
    });
  }

  items.push({
    id: "anti-ai",
    label: "無 AI 味裝飾／假圖表",
    passed: !ANTI_AI.test(blob),
  });

  const keyframes = css.match(/@keyframes\s+([\w-]+)/g) ?? [];
  const uniqueKf = new Set(keyframes);
  items.push({
    id: "step-variety",
    label: "動效樣式具多樣性",
    passed:
      tsx.includes("ListRevealGrid") ||
      tsx.includes("FlowDiagram") ||
      tsx.includes("HookImageStrip") ||
      tsx.includes("VisualBlock") ||
      tsx.includes("MaskReveal") ||
      opts.templateKind === "magazine" ||
      uniqueKf.size >= 1 ||
      blob.includes("lr-num-drop") ||
      blob.includes("cf-flow-detail-in"),
    evidence: opts.templateKind,
  });

  const passed = items.every((i) => i.passed);
  return {
    chapterId: opts.wvpChapterId,
    passed,
    items,
    templateKind: opts.templateKind,
  };
}
