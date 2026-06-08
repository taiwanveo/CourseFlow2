import { screenTextOnly } from "./slots.js";

export interface HookSlide {
  url: string | null;
  alt: string;
  caption: string;
  label: string;
}

export interface ChapterAssetInput {
  url: string;
  alt?: string;
  step?: number;
  wvpChapterId?: string;
}

export const HOOK_SLIDE_MAX = 3;

export function assetsForChapter(
  assets: ChapterAssetInput[] | undefined,
  wvpChapterId: string,
): ChapterAssetInput[] {
  if (!assets?.length) return [];
  return assets.filter((a) => !a.url?.trim() ? false : !a.wvpChapterId || a.wvpChapterId === wvpChapterId);
}

/** 依步驟選圖：有 step 則精準對應，否則非封面步驟沿用本章第一張 */
export function assetForStep(
  assets: ChapterAssetInput[],
  step: number,
): ChapterAssetInput | undefined {
  const withUrl = assets.filter((a) => a.url?.trim());
  if (!withUrl.length) return undefined;
  const exact = withUrl.find((a) => a.step === step);
  if (exact) return exact;
  if (step === 0) return withUrl.find((a) => a.step === 0) ?? undefined;
  return withUrl[0];
}

/** 依已上傳開場圖（step 1–3 或依序三張）推算應有 slide 數 */
export function hookAssetSlideCount(assets: ChapterAssetInput[]): number {
  const withUrl = assets.filter((a) => a.url?.trim());
  if (!withUrl.length) return 0;
  let maxStep = 0;
  for (let s = 1; s <= HOOK_SLIDE_MAX; s++) {
    if (withUrl.some((a) => a.step === s)) maxStep = s;
  }
  if (maxStep > 0) return maxStep;
  return Math.min(HOOK_SLIDE_MAX, withUrl.length);
}

function hookSlideCountFromNarrations(narrationCount: number): number {
  if (narrationCount <= 1) return 1;
  const afterDivider = narrationCount - 1;
  if (afterDivider <= 1) return afterDivider;
  return Math.min(HOOK_SLIDE_MAX, afterDivider - 1);
}

/**
 * Hook slide 張數：取「口播步數推算」與「已上傳開場圖」的較大值（上限 3）。
 * 使用者上傳 3 張時，即使章節僅 2 步口播，仍應產出 3 張 slide。
 */
export function hookSlideCount(
  narrationCount: number,
  assets?: ChapterAssetInput[],
): number {
  const fromNarrations = hookSlideCountFromNarrations(narrationCount);
  const fromAssets = assets?.length ? hookAssetSlideCount(assets) : 0;
  return Math.min(HOOK_SLIDE_MAX, Math.max(1, fromNarrations, fromAssets));
}

function hookSlideAsset(
  withUrl: ChapterAssetInput[],
  slideIndex: number,
): ChapterAssetInput | undefined {
  const wvpStep = slideIndex + 1;
  const exact = withUrl.find((a) => a.step === wvpStep);
  if (exact) return exact;
  const hasStepTags = withUrl.some((a) => typeof a.step === "number" && a.step >= 1);
  if (!hasStepTags) return withUrl[slideIndex];
  return undefined;
}

export function buildHookSlides(
  assets: ChapterAssetInput[],
  narrationCount: number,
  screenContents: string[] = [],
): HookSlide[] {
  const withUrl = assets.filter((a) => a.url?.trim());
  const count = hookSlideCount(narrationCount, withUrl);
  const slides: HookSlide[] = [];

  for (let i = 0; i < count; i++) {
    const asset = hookSlideAsset(withUrl, i);
    const cap = screenTextOnly(screenContents[i + 1]);
    slides.push({
      url: asset?.url?.trim() ?? null,
      alt: cap.slice(0, 24),
      caption: cap,
      label: `${String(i + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`,
    });
  }
  return slides;
}

/**
 * 幽靈格(0) + N 張全屏 slide + takeover 所需最少旁白步數。
 * 步數不足時以空字串補齊，讓播放器能逐步推進到每張開場圖。
 */
export function padNarrationsForHook(narrations: string[], slideCount: number): string[] {
  const minLen = slideCount + 2;
  if (narrations.length >= minLen) return [...narrations];
  const out = [...narrations];
  while (out.length < minLen) out.push("");
  return out;
}

/** @deprecated 請改用 padNarrationsForHook */
export function hookNarrationsForSlides(
  original: string[],
  slideCount: number,
  _includeClose: boolean,
): string[] {
  return padNarrationsForHook(original, slideCount);
}

/** @deprecated 播放器步數 = narrations.length */
export function hookStepCount(slideCount: number, includeClose: boolean): number {
  return 1 + slideCount + 1 + (includeClose ? 1 : 0);
}

function hookSlideCountFromChapterSources(
  narrations: string[],
  chapterTsx: string,
  chapterDslTs?: string,
  assets?: ChapterAssetInput[],
): number {
  let slideCount = hookSlideCount(narrations.length, assets);

  const legacySlides = chapterTsx.match(/const\s+SLIDES\s*=\s*(\[[\s\S]*?\])\s*as\s+const/);
  if (legacySlides?.[1]) {
    try {
      const parsed = JSON.parse(legacySlides[1]) as unknown[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        slideCount = Math.max(slideCount, parsed.length);
      }
    } catch {
      /* ignore malformed legacy SLIDES */
    }
  }

  const dsl = chapterDslTs?.trim() ?? "";
  if (dsl.includes("hookBundle")) {
    const slidesBlock = dsl.match(/"slides"\s*:\s*(\[[\s\S]*?\])\s*,\s*"takeoverTitle"/);
    if (slidesBlock?.[1]) {
      try {
        const parsed = JSON.parse(slidesBlock[1]) as unknown[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          slideCount = Math.max(slideCount, parsed.length);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return slideCount;
}

/**
 * 沿用快取 TSX 寫入 narrations.ts 前，補齊 Hook 幽靈格／全屏／takeover 所需步數。
 */
export function normalizeCachedChapterNarrations(
  narrations: string[],
  chapterTsx: string,
  opts?: {
    chapterDslTs?: string;
    assets?: ChapterAssetInput[];
  },
): string[] {
  const tsx = chapterTsx ?? "";
  const dsl = opts?.chapterDslTs?.trim() ?? "";
  const isHook =
    /HookImageStrip/.test(tsx) ||
    /chapterLayout["']:\s*["']hook/.test(dsl) ||
    /"templateKind"\s*:\s*"hook"/.test(dsl);

  if (!isHook) return narrations;

  const slideCount = hookSlideCountFromChapterSources(
    narrations,
    tsx,
    dsl,
    opts?.assets,
  );
  return padNarrationsForHook(narrations, slideCount);
}
