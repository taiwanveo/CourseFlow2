import type { CourseComposition } from "@courseflow/core";
import { getOrderedSteps } from "@courseflow/core";

export type WvpAudioBuildGate = {
  ready: boolean;
  totalSteps: number;
  synthesizedSteps: number;
  message: string | null;
};

/** WVP 打包前須完成文稿各步的 TTS（含章節分隔頁） */
export function evaluateWvpAudioBuildGate(
  composition: CourseComposition,
): WvpAudioBuildGate {
  const steps = getOrderedSteps(composition);
  if (steps.length === 0) {
    return {
      ready: false,
      totalSteps: 0,
      synthesizedSteps: 0,
      message: "文稿尚無可配音的步驟，請先完成「1. 文稿內容」",
    };
  }

  const withAudio = new Set(
    composition.audio
      .filter((a) => a.stepId && (a.storagePath?.trim() || a.publicUrl?.trim()))
      .map((a) => a.stepId as string),
  );
  const synthesizedSteps = steps.filter((s) => withAudio.has(s.id)).length;
  const ready = synthesizedSteps >= steps.length;

  return {
    ready,
    totalSteps: steps.length,
    synthesizedSteps,
    message: ready
      ? null
      : `請先在「3. 語音生成」完成 TTS 合成（目前 ${synthesizedSteps}/${steps.length} 步已有語音檔），再到「4. 預覽匯出」打包預覽。`,
  };
}
