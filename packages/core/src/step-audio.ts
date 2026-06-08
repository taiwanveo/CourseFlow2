import type { StepAudio } from "./composition.js";

export function stepAudioUpdatedAtMs(audio: StepAudio): number {
  if (!audio.updatedAt) return 0;
  const ms = Date.parse(audio.updatedAt);
  return Number.isFinite(ms) ? ms : 0;
}

/** 合併音訊條目：保留較新 updatedAt 的版本，避免自動儲存蓋掉剛合成的語音。 */
export function mergeStepAudioEntries(
  existing: StepAudio[],
  incoming: StepAudio[],
): StepAudio[] {
  const byStep = new Map<string, StepAudio>();
  for (const entry of existing) {
    if (entry.stepId) byStep.set(entry.stepId, entry);
  }
  for (const entry of incoming) {
    if (!entry.stepId) continue;
    const prev = byStep.get(entry.stepId);
    if (!prev || stepAudioUpdatedAtMs(entry) >= stepAudioUpdatedAtMs(prev)) {
      byStep.set(entry.stepId, entry);
    }
  }
  return Array.from(byStep.values());
}

/** 播放用 URL：同一 Storage 路徑覆寫後仍強制瀏覽器重新抓取。 */
export function stepAudioPlaybackUrl(
  audio: Pick<StepAudio, "publicUrl" | "updatedAt">,
): string | undefined {
  const url = audio.publicUrl?.trim();
  if (!url) return undefined;
  if (!audio.updatedAt) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(audio.updatedAt)}`;
}
