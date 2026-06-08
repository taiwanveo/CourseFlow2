import type { StepDslChapterData } from "./step-dsl-types";

const LAYOUTS = new Set([
  "center-title",
  "visual-focus",
  "explain-focus",
  "split-focus",
  "visual-explain-composite",
  "beat-scene",
]);
const CHAPTER_LAYOUTS = new Set(["per-step", "list-reveal", "flow", "hook"]);

/** 執行期輕量驗證；失敗回傳 null（呼叫端可降級） */
export function parseStepDslChapterRuntime(raw: unknown): StepDslChapterData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.kicker !== "string") return null;
  if (typeof o.templateKind !== "string") return null;
  if (!CHAPTER_LAYOUTS.has(String(o.chapterLayout))) return null;
  if (!Array.isArray(o.steps) || o.steps.length < 1) return null;

  const steps = o.steps.map((s, i) => {
    if (!s || typeof s !== "object") return null;
    const st = s as Record<string, unknown>;
    const step = typeof st.step === "number" ? st.step : i;
    const layout = String(st.layout ?? "center-title");
    if (!LAYOUTS.has(layout)) return null;
    const screen = st.screen as { headline?: string; sub?: string; kicker?: string } | undefined;
    const headline = screen?.headline;
    if (typeof headline !== "string") return null;
    const enterRaw = st.enter as { enterAnimationId?: string; transitionId?: string } | undefined;
    const enter = {
      enterAnimationId: enterRaw?.enterAnimationId ?? "fade-up",
      transitionId: enterRaw?.transitionId ?? "crossfade",
    };
    return {
      step,
      layout: layout as StepDslChapterData["steps"][0]["layout"],
      screen: {
        headline,
        ...(screen?.sub ? { sub: screen.sub } : {}),
        ...(screen?.kicker ? { kicker: screen.kicker } : {}),
      },
      enter,
      ...(st.visual && typeof st.visual === "object" ? { visual: st.visual as Record<string, unknown> } : {}),
      ...(st.explain && typeof st.explain === "object" ? { explain: st.explain as StepDslChapterData["steps"][0]["explain"] } : {}),
      ...(typeof st.animationHtml === "string" ? { animationHtml: st.animationHtml } : {}),
      ...(typeof st.animationStep === "number" ? { animationStep: st.animationStep } : {}),
      ...(typeof st.imageUrl === "string" ? { imageUrl: st.imageUrl } : {}),
      ...(typeof st.imageStep === "number" ? { imageStep: st.imageStep } : {}),
      ...(typeof st.narration === "string" ? { narration: st.narration } : {}),
      ...(typeof st.screenRaw === "string" ? { screenRaw: st.screenRaw } : {}),
    };
  });
  if (steps.some((s) => s === null)) return null;

  return {
    version: 1,
    templateKind: String(o.templateKind),
    chapterLayout: o.chapterLayout as StepDslChapterData["chapterLayout"],
    kicker: o.kicker,
    steps: steps as StepDslChapterData["steps"],
    ...(o.listBundle && typeof o.listBundle === "object"
      ? { listBundle: o.listBundle as StepDslChapterData["listBundle"] }
      : {}),
    ...(o.flowBundle && typeof o.flowBundle === "object"
      ? { flowBundle: o.flowBundle as StepDslChapterData["flowBundle"] }
      : {}),
    ...(o.hookBundle && typeof o.hookBundle === "object"
      ? { hookBundle: o.hookBundle as StepDslChapterData["hookBundle"] }
      : {}),
  };
}
