export type WvpBuildPhase =
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
};

export const WVP_BUILD_PHASE_ORDER: WvpBuildPhase[] = [
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

/** 各階段完成後的累積進度（%） */
export const WVP_BUILD_PHASE_PERCENT: Record<WvpBuildPhase, number> = {
  prepare: 8,
  assets: 14,
  audio: 24,
  illustrations: 40,
  animations: 52,
  registry: 58,
  vite: 92,
  upload: 98,
  done: 100,
};

export function createInitialWvpBuildProgress(chapterCount?: number): WvpBuildProgress {
  return {
    phase: "prepare",
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

export function parseWvpBuildProgress(raw: unknown): WvpBuildProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const progress = (raw as { progress?: unknown }).progress;
  if (!progress || typeof progress !== "object") return null;
  const p = progress as WvpBuildProgress;
  if (typeof p.phase !== "string" || !Array.isArray(p.stageDurationsMs)) return null;
  return p;
}
