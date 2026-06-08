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

/**
 * Hook slide 張數：步驟 0 為章節分隔頁，其後至 takeover 前為 slide（上限 3）。
 * 禁止硬塞 3 張；步驟數不足就少一些 slide。
 */
export function hookSlideCount(narrationCount: number): number {
  if (narrationCount <= 1) return 1;
  const afterDivider = narrationCount - 1;
  if (afterDivider <= 1) return afterDivider;
  return Math.min(HOOK_SLIDE_MAX, afterDivider - 1);
}

export function buildHookSlides(
  assets: ChapterAssetInput[],
  narrationCount: number,
  screenContents: string[] = [],
): HookSlide[] {
  const withUrl = assets.filter((a) => a.url?.trim());
  const count = hookSlideCount(narrationCount);
  const slides: HookSlide[] = [];

  for (let i = 0; i < count; i++) {
    const asset = withUrl[i];
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

/** @deprecated Hook 已改為 WVP 逐步 1:1，不再重寫 narrations */
export function hookNarrationsForSlides(
  original: string[],
  slideCount: number,
  includeClose: boolean,
): string[] {
  return original;
}

/** @deprecated 播放器步數 = narrations.length */
export function hookStepCount(slideCount: number, includeClose: boolean): number {
  return 1 + slideCount + 1 + (includeClose ? 1 : 0);
}
