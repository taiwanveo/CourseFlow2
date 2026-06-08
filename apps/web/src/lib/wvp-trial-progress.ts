import type { CompactBatchProgress } from "@/components/CompactBatchProgressPanel";
import type { CompactBatchItemStatus } from "@/components/CompactBatchProgressPanel";

export type WvpTrialChapterProgress = {
  phase: string;
  startedAt: string;
  stageDurationsMs: number[];
  chapterTitle?: string;
  subCurrent?: number;
  subTotal?: number;
  subLabel?: string;
  uploadStartedAt?: string;
};

export const TRIAL_STAGE_ORDER = [
  "start",
  "composition-loaded",
  "narration-synced",
  "template-applied",
  "chapter-craft-skipped-trial-template",
  "vite-build-start",
  "vite-build-done",
  "dist-upload-start",
  "dist-upload-done",
  "preview-built",
] as const;

export type WvpTrialStage = (typeof TRIAL_STAGE_ORDER)[number];

export const TRIAL_STAGE_LABEL: Record<string, string> = {
  start: "啟動試執行",
  "composition-loaded": "載入課程文稿",
  "narration-synced": "匯入口播",
  "template-applied": "套用視覺模板",
  "chapter-craft-skipped-trial-template": "確認畫面版型",
  "vite-build-start": "Vite 編譯預覽",
  "vite-build-done": "編譯完成",
  "dist-upload-start": "上傳預覽檔",
  "dist-upload-done": "上傳完成",
  "preview-built": "完成打包",
};

export function createInitialTrialProgress(chapterTitle?: string): WvpTrialChapterProgress {
  return {
    phase: "start",
    startedAt: new Date().toISOString(),
    stageDurationsMs: [],
    chapterTitle,
  };
}

export function advanceTrialProgress(
  current: WvpTrialChapterProgress,
  stage: string,
): WvpTrialChapterProgress {
  const now = Date.now();
  const startedMs = Date.parse(current.startedAt);
  const elapsed = Number.isFinite(startedMs) ? now - startedMs : 0;
  return {
    ...current,
    phase: stage,
    stageDurationsMs: [...current.stageDurationsMs, elapsed],
  };
}

export function parseWvpTrialProgress(raw: unknown): WvpTrialChapterProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const progress = (raw as { progress?: unknown }).progress;
  if (!progress || typeof progress !== "object") return null;
  const p = progress as WvpTrialChapterProgress;
  if (typeof p.phase !== "string" || !Array.isArray(p.stageDurationsMs)) return null;
  return p;
}

export function estimateTrialRemainingMs(progress: WvpTrialChapterProgress): number | null {
  const { stageDurationsMs, phase } = progress;
  if (stageDurationsMs.length === 0) return null;

  if (
    phase === "dist-upload-start" &&
    progress.uploadStartedAt &&
    progress.subTotal !== undefined &&
    progress.subCurrent !== undefined &&
    progress.subTotal > 0 &&
    progress.subCurrent > 0 &&
    progress.subCurrent < progress.subTotal
  ) {
    const uploadElapsedMs = Date.now() - new Date(progress.uploadStartedAt).getTime();
    if (uploadElapsedMs > 500) {
      const perFile = uploadElapsedMs / progress.subCurrent;
      return Math.round(perFile * (progress.subTotal - progress.subCurrent));
    }
  }

  const avg = stageDurationsMs.reduce((sum, ms) => sum + ms, 0) / stageDurationsMs.length;
  const idx = TRIAL_STAGE_ORDER.indexOf(phase as WvpTrialStage);
  const remaining = idx < 0 ? 4 : Math.max(0, TRIAL_STAGE_ORDER.length - 1 - idx);
  return Math.round(avg * remaining);
}

function trialStageIndex(phase: string): number {
  const idx = TRIAL_STAGE_ORDER.indexOf(phase as WvpTrialStage);
  return idx < 0 ? 0 : idx;
}

export function toTrialCompactProgress(
  progress: WvpTrialChapterProgress | null,
  optimisticPhaseIndex?: number,
): CompactBatchProgress | null {
  const stageIdx =
    progress !== null
      ? trialStageIndex(progress.phase)
      : optimisticPhaseIndex !== undefined
        ? Math.max(0, Math.min(optimisticPhaseIndex, TRIAL_STAGE_ORDER.length - 1))
        : null;

  if (stageIdx === null) return null;

  const phaseId = TRIAL_STAGE_ORDER[stageIdx]!;
  const items = TRIAL_STAGE_ORDER.map((id, idx) => {
    let status: CompactBatchItemStatus = "pending";
    if (idx < stageIdx) status = "done";
    else if (idx === stageIdx) {
      status = id === "preview-built" && progress?.phase === "preview-built" ? "done" : "running";
    }
    return { id, label: TRIAL_STAGE_LABEL[id] ?? id, status };
  });

  const uploadSub =
    phaseId === "dist-upload-start" &&
    progress?.subLabel?.trim()
      ? ` · ${progress.subLabel.trim()}`
      : phaseId === "dist-upload-start" &&
          progress?.subCurrent !== undefined &&
          progress?.subTotal !== undefined &&
          progress.subTotal > 0
        ? ` · 檔案 ${progress.subCurrent}/${progress.subTotal}`
        : "";

  return {
    phaseLabel: `${TRIAL_STAGE_LABEL[phaseId] ?? "試執行中"}${uploadSub}`,
    currentIndex: stageIdx,
    totalItems: TRIAL_STAGE_ORDER.length,
    currentLabel: progress?.chapterTitle?.trim() || "第 1 章",
    itemUnit: "步驟",
    itemDurationsMs: progress?.stageDurationsMs ?? [],
    items,
  };
}

/** 同步請求／無伺服器進度時依耗時推進試執行階段索引 */
export function estimateTrialOptimisticPhaseIndex(elapsedMs: number): number {
  if (elapsedMs < 5_000) return 0;
  if (elapsedMs < 15_000) return 1;
  if (elapsedMs < 30_000) return 2;
  if (elapsedMs < 50_000) return 3;
  if (elapsedMs < 90_000) return 4;
  if (elapsedMs < 150_000) return 6;
  if (elapsedMs < 210_000) return 8;
  return 9;
}
