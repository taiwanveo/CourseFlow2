import { HOOK_SLIDE_STEP_MAX } from "@/lib/wvp-hook-constants";
import type { WvpAssetRef } from "@/lib/wvp-settings";

/** 選多圖開場時的 toast／inline 提示（步驟 2–4 各一張） */
export const HOOK_OPENING_HINT =
  "請至配圖工作室 → 步驟配圖，為步驟 2–4 各準備一張圖";

/** Hook 開場圖對應的 0-based 步驟索引（UI 顯示為步驟 2、3、4） */
export const HOOK_SLIDE_STEP_INDICES = [1, 2, 3] as const;

export function countHookChapterAssets(
  assets: WvpAssetRef[] | undefined,
  wvpChapterId: string,
): number {
  return (assets ?? []).filter(
    (a) => a.url?.trim() && a.wvpChapterId === wvpChapterId,
  ).length;
}

type IllustrationStepLike = {
  stepIndex: number;
  imageWritten?: boolean;
  status?: string;
};

function stepIllustrationDone(step: IllustrationStepLike | undefined): boolean {
  return Boolean(step && (step.imageWritten || step.status === "done"));
}

/** 開場圖是否已齊（章節資產 3 張，或步驟配圖 2–4 皆已有圖） */
export function hookOpeningImagesReady(
  assets: WvpAssetRef[] | undefined,
  wvpChapterId: string,
  illustrationSteps?: IllustrationStepLike[],
): boolean {
  if (countHookChapterAssets(assets, wvpChapterId) >= HOOK_SLIDE_STEP_MAX) {
    return true;
  }
  if (!illustrationSteps?.length) return false;
  return HOOK_SLIDE_STEP_INDICES.every((idx) =>
    stepIllustrationDone(illustrationSteps.find((s) => s.stepIndex === idx)),
  );
}

/** 預覽前警告文案；已齊則回傳 null */
export function hookPreviewWarningMessage(
  assets: WvpAssetRef[] | undefined,
  wvpChapterId: string,
  illustrationSteps?: IllustrationStepLike[],
): string | null {
  if (hookOpeningImagesReady(assets, wvpChapterId, illustrationSteps)) {
    return null;
  }
  return "此章為多圖開場，步驟 2–4 尚缺開場圖，預覽可能顯示空白幽靈格。仍要繼續打包預覽？";
}
