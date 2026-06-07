export type WvpBatchCraftChapterStatus =
  | "pending"
  | "running"
  | "synced"
  | "generated"
  | "materialized"
  | "skipped"
  | "failed";

export type WvpBatchCraftPhase =
  | "sync"
  | "generate"
  | "materialize"
  | "build"
  | "done";

export type WvpBatchCraftChapterProgress = {
  wvpChapterId: string;
  title: string;
  sortOrder: number;
  status: WvpBatchCraftChapterStatus;
  error?: string;
  chapterSource?: "llm" | "template";
};

export type WvpBatchCraftProgress = {
  phase: WvpBatchCraftPhase;
  currentChapterIndex: number;
  totalChapters: number;
  currentWvpChapterId?: string;
  currentTitle?: string;
  startedAt: string;
  chapterDurationsMs: number[];
  chapters: WvpBatchCraftChapterProgress[];
};

export type WvpBatchCraftJobSummary = {
  total: number;
  synced: number;
  generated: number;
  failed: number;
  built?: boolean;
};

export type WvpBatchCraftJobResult = {
  ok: boolean;
  mode: "batch-craft" | "batch-craft-build";
  progress?: WvpBatchCraftProgress;
  summary: WvpBatchCraftJobSummary;
  warning?: string;
  cancelled?: boolean;
};

export const BATCH_CRAFT_PHASE_LABEL: Record<WvpBatchCraftPhase, string> = {
  sync: "匯入口播",
  generate: "產生視覺程式",
  materialize: "寫入預覽檔案",
  build: "打包預覽",
  done: "完成",
};

export function createInitialBatchProgress(
  chapters: Array<{ wvpChapterId: string; title: string; sortOrder: number }>,
): WvpBatchCraftProgress {
  return {
    phase: "sync",
    currentChapterIndex: 0,
    totalChapters: chapters.length,
    startedAt: new Date().toISOString(),
    chapterDurationsMs: [],
    chapters: chapters.map((ch) => ({
      wvpChapterId: ch.wvpChapterId,
      title: ch.title,
      sortOrder: ch.sortOrder,
      status: "pending",
    })),
  };
}

export function estimateBatchRemainingMs(progress: WvpBatchCraftProgress): number | null {
  const { chapterDurationsMs, chapters, totalChapters } = progress;
  if (chapterDurationsMs.length === 0) return null;
  const avg =
    chapterDurationsMs.reduce((sum, ms) => sum + ms, 0) / chapterDurationsMs.length;
  const doneCount = chapters.filter((ch) =>
    ["synced", "generated", "materialized", "skipped", "failed"].includes(ch.status),
  ).length;
  const remaining = Math.max(0, totalChapters - doneCount);
  return Math.round(avg * remaining);
}

export function formatEtaMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "計算中…";
  if (ms < 60_000) return `約 ${Math.max(1, Math.round(ms / 1000))} 秒`;
  const minutes = Math.ceil(ms / 60_000);
  return `約 ${minutes} 分鐘`;
}
