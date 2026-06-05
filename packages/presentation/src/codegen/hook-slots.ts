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

export function buildHookSlides(
  assets: ChapterAssetInput[],
  narrations: string[],
  screenContents: string[] = [],
): HookSlide[] {
  const withUrl = assets.filter((a) => a.url?.trim());
  const count = Math.max(1, Math.min(3, withUrl.length || 3));
  const slides: HookSlide[] = [];

  for (let i = 0; i < count; i++) {
    const asset = withUrl[i];
    const cap = screenTextOnly(screenContents[i + 1], `重點 ${i + 1}`);
    slides.push({
      url: asset?.url?.trim() ?? null,
      alt: asset?.alt?.trim() || cap.slice(0, 24),
      caption: cap,
      label: `${String(i + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`,
    });
  }
  return slides;
}

export function hookNarrationsForSlides(
  original: string[],
  slideCount: number,
  includeClose: boolean,
): string[] {
  const intro = original[0]?.trim() || "本章開場";
  const mids: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    mids.push(original[i + 1]?.trim() || `重點 ${i + 1}`);
  }
  const takeover =
    original[Math.max(1, original.length - 2)]?.trim() ||
    original[original.length - 1]?.trim() ||
    intro;
  const out = [intro, ...mids, takeover];
  if (includeClose) {
    const close = original[original.length - 1]?.trim();
    if (close && close !== takeover) out.push(close);
  }
  return out;
}

export function hookStepCount(slideCount: number, includeClose: boolean): number {
  return 1 + slideCount + 1 + (includeClose ? 1 : 0);
}
