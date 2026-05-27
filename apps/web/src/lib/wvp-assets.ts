import type { WvpAssetRef } from "@/lib/wvp-settings";

/** 轉成 presentation codegen 用的章節素材 */
export function chapterAssetsForCodegen(
  assets: WvpAssetRef[] | undefined,
  wvpChapterId: string,
): { url: string; alt?: string; step?: number; wvpChapterId?: string }[] {
  if (!assets?.length) return [];
  return assets
    .filter((a) => a.url?.trim())
    .filter((a) => !a.wvpChapterId || a.wvpChapterId === wvpChapterId)
    .map((a) => ({
      url: a.url.trim(),
      alt: a.alt,
      step: a.step,
      wvpChapterId: a.wvpChapterId,
    }));
}
