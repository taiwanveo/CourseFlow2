/**
 * 舞台文字自適應：量測溢出後縮小 font-size，確保內容留在安全區、不蓋字幕帶。
 * 適用於各主題共用（不依賴主題 tokens）。
 */

export const STAGE_TEXT_FIT_SELECTOR = [
  "[data-stage-text-fit]",
  ".stage-text-fit",
  ".lr-intro-h",
  ".lr-featured-title",
  ".lr-slot-title",
  ".bs-headline",
  ".hk-hero",
  ".hk-quote",
  ".hk-placeholder-screen",
  '[class$="-cover-h"]',
  '[class$="-split-h"]',
  '[class$="-quote"]',
  ".usd-screen",
  ".vf-headline-text",
  ".cf-flow-intro",
  ".cf-narration-beat-line",
].join(",");

function sceneBudget(el: HTMLElement): { maxW: number; maxH: number } {
  const scene = el.closest(".scene") as HTMLElement | null;
  if (!scene) {
    return { maxW: el.clientWidth, maxH: el.clientHeight };
  }
  const pad = 24;
  const style = getComputedStyle(scene);
  const padX =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const padY =
    (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const maxW = Math.max(120, scene.clientWidth - padX - pad);
  const maxH = Math.max(80, scene.clientHeight - padY - pad);
  return { maxW, maxH };
}

function isHeadline(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "H1" || tag === "H2") return true;
  return /headline|intro-h|featured-title|cover-h|split-h|hk-hero|hk-quote|usd-screen/i.test(
    el.className,
  );
}

/** 單一節點：從 CSS 預設字級往下縮，直到不溢出舞台預算或達下限。 */
export function fitStageTextElement(el: HTMLElement): void {
  el.style.fontSize = "";
  el.style.removeProperty("--stage-text-fit-scale");

  const computed = getComputedStyle(el);
  let size = Number.parseFloat(computed.fontSize);
  if (!Number.isFinite(size) || size <= 0) return;

  const { maxW, maxH } = sceneBudget(el);
  const minSize = Math.max(isHeadline(el) ? 36 : 28, size * 0.42);

  el.style.maxWidth = `${maxW}px`;
  if (isHeadline(el)) {
    el.style.maxHeight = `${Math.floor(maxH * 0.72)}px`;
  }

  let guard = 0;
  while (guard++ < 80) {
    const overH = el.scrollHeight > el.clientHeight + 2;
    const overW = el.scrollWidth > el.clientWidth + 2;
    if ((!overH && !overW) || size <= minSize) break;
    size -= 2;
    el.style.fontSize = `${size}px`;
  }

  if (size < Number.parseFloat(computed.fontSize) - 0.5) {
    el.dataset.stageTextFitted = "1";
  } else {
    delete el.dataset.stageTextFitted;
  }
}

export function fitStageTextNodes(root: ParentNode = document): void {
  const nodes = root.querySelectorAll<HTMLElement>(STAGE_TEXT_FIT_SELECTOR);
  for (const el of nodes) {
    if (!el.isConnected || el.offsetParent === null && el.clientHeight === 0) continue;
    fitStageTextElement(el);
  }
}

/** 等 MaskReveal / 進場動畫跑完後多次重算。 */
export function scheduleStageTextFit(root?: ParentNode): void {
  const run = () => fitStageTextNodes(root ?? document);
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 100);
  window.setTimeout(run, 420);
  window.setTimeout(run, 900);
  window.setTimeout(run, 1400);
}
