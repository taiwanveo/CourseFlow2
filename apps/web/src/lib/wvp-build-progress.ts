export type WvpBuildPhase =
  | "start"
  | "loading-composition"
  | "scaffolding"
  | "registry-init"
  | "prepare"
  | "assets"
  | "audio"
  | "illustrations"
  | "animations"
  | "registry"
  | "vite"
  | "upload"
  | "done";

export type WvpBuildProgress = {
  phase: WvpBuildPhase;
  startedAt: string;
  chapterCount?: number;
  stageDurationsMs: number[];
  /** 長任務子進度：目前項次 */
  subCurrent?: number;
  /** 長任務子進度：總項次 */
  subTotal?: number;
  /** 子進度說明，例如「配圖 3/12」 */
  subLabel?: string;
  /** 最近失敗的 API 錯誤原文（供 UI 顯示） */
  lastError?: string;
};

export type WvpBuildStageUpdate = {
  chapterCount?: number;
  subCurrent?: number;
  subTotal?: number;
  subLabel?: string;
};

export const WVP_BUILD_PHASE_ORDER: WvpBuildPhase[] = [
  "start",
  "loading-composition",
  "scaffolding",
  "registry-init",
  "prepare",
  "assets",
  "audio",
  "illustrations",
  "animations",
  "registry",
  "vite",
  "upload",
  "done",
];

export const WVP_BUILD_PHASE_LABEL: Record<WvpBuildPhase, string> = {
  start: "啟動打包",
  "loading-composition": "載入文稿",
  scaffolding: "準備工作區",
  "registry-init": "重建章節清單",
  prepare: "準備專案",
  assets: "同步素材",
  audio: "寫入語音",
  illustrations: "同步配圖",
  animations: "同步動效",
  registry: "組裝章節",
  vite: "Vite 編譯",
  upload: "上傳預覽",
  done: "完成",
};

/** 各階段進入時的基準進度（%） */
export const WVP_BUILD_PHASE_PERCENT: Record<WvpBuildPhase, number> = {
  start: 2,
  "loading-composition": 5,
  scaffolding: 8,
  "registry-init": 12,
  prepare: 15,
  assets: 20,
  audio: 28,
  illustrations: 35,
  animations: 52,
  registry: 58,
  vite: 62,
  upload: 96,
  done: 100,
};

function phasePercentRange(phase: WvpBuildPhase): { floor: number; ceiling: number } {
  const idx = WVP_BUILD_PHASE_ORDER.indexOf(phase);
  const floor = WVP_BUILD_PHASE_PERCENT[phase];
  const next = WVP_BUILD_PHASE_ORDER[idx + 1];
  const ceiling = next ? WVP_BUILD_PHASE_PERCENT[next] : 100;
  return { floor, ceiling };
}

/** 依階段與子進度計算顯示百分比 */
export function displayWvpBuildPercent(progress: WvpBuildProgress): number {
  const { floor, ceiling } = phasePercentRange(progress.phase);
  if (
    progress.subCurrent !== undefined &&
    progress.subTotal !== undefined &&
    progress.subTotal > 0
  ) {
    const ratio = Math.min(1, Math.max(0, progress.subCurrent / progress.subTotal));
    return Math.round(floor + (ceiling - floor) * ratio);
  }
  return floor;
}

export function formatWvpBuildProgressLabel(progress: WvpBuildProgress): string {
  const phase = WVP_BUILD_PHASE_LABEL[progress.phase] ?? progress.phase;
  const chapters =
    progress.chapterCount && progress.chapterCount > 0
      ? ` · ${progress.chapterCount} 章`
      : "";
  const sub =
    progress.subLabel?.trim() ??
    (progress.subCurrent !== undefined &&
    progress.subTotal !== undefined &&
    progress.subTotal > 0
      ? `${progress.subCurrent}/${progress.subTotal}`
      : "");
  return sub ? `${phase} · ${sub}${chapters}` : `${phase}${chapters}`;
}

export function createInitialWvpBuildProgress(chapterCount?: number): WvpBuildProgress {
  return {
    phase: "start",
    startedAt: new Date().toISOString(),
    chapterCount,
    stageDurationsMs: [],
  };
}

export function estimateWvpBuildRemainingMs(progress: WvpBuildProgress): number | null {
  const { stageDurationsMs, phase } = progress;
  if (stageDurationsMs.length === 0) return null;
  const avg = stageDurationsMs.reduce((sum, ms) => sum + ms, 0) / stageDurationsMs.length;
  const currentIdx = WVP_BUILD_PHASE_ORDER.indexOf(phase);
  const remainingPhases = Math.max(0, WVP_BUILD_PHASE_ORDER.length - 1 - currentIdx);
  return Math.round(avg * remainingPhases);
}

export function formatEtaMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "計算中…";
  if (ms < 60_000) return `約 ${Math.max(1, Math.round(ms / 1000))} 秒`;
  const minutes = Math.ceil(ms / 60_000);
  return `約 ${minutes} 分鐘`;
}

/** 無伺服器進度更新時，依耗時推進樂觀百分比（上限約 55%，避免超前太多） */
export function estimateWvpBuildOptimisticPercent(elapsedMs: number): number {
  if (elapsedMs < 2_000) return 2;
  if (elapsedMs < 5_000) return 5;
  if (elapsedMs < 12_000) return 8;
  if (elapsedMs < 25_000) return 12;
  if (elapsedMs < 45_000) return 18;
  if (elapsedMs < 75_000) return 24;
  if (elapsedMs < 120_000) return 30;
  if (elapsedMs < 180_000) return 38;
  if (elapsedMs < 300_000) return 48;
  return 55;
}

/**
 * 合併伺服器進度與樂觀進度：伺服器為準，樂觀僅在卡頓時緩慢往前推進（最多超前 10%）。
 */
export function blendWvpBuildPercent(
  progress: WvpBuildProgress | null,
  elapsedMs: number,
): number {
  if (!progress) {
    return estimateWvpBuildOptimisticPercent(elapsedMs);
  }
  if (progress.phase === "done") return 100;
  const server = displayWvpBuildPercent(progress);
  const optimistic = estimateWvpBuildOptimisticPercent(elapsedMs);
  const ceiling = Math.min(95, server + 10);
  return Math.max(server, Math.min(optimistic, ceiling));
}

export function parseWvpBuildProgress(raw: unknown): WvpBuildProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const progress = (raw as { progress?: unknown }).progress;
  if (!progress || typeof progress !== "object") return null;
  const p = progress as WvpBuildProgress;
  if (typeof p.phase !== "string" || !Array.isArray(p.stageDurationsMs)) return null;
  return p;
}
