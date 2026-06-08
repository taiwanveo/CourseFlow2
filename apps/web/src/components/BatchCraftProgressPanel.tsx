"use client";

import {
  CompactBatchProgressPanel,
  type CompactBatchItemStatus,
} from "@/components/CompactBatchProgressPanel";
import {
  BATCH_CRAFT_PHASE_LABEL,
  estimateBatchRemainingMs,
  formatEtaMs,
  type WvpBatchCraftChapterProgress,
  type WvpBatchCraftProgress,
} from "@/lib/wvp-batch-craft-progress";

const CHAPTER_STATUS_ICON: Record<WvpBatchCraftChapterProgress["status"], string> = {
  pending: "○",
  running: "⟳",
  synced: "◐",
  generated: "◑",
  materialized: "✓",
  skipped: "—",
  failed: "✗",
};

type BatchCraftProgressPanelProps = {
  progress: WvpBatchCraftProgress | null;
  busy: boolean;
  compact?: boolean;
  queueHint?: string | null;
  onCancel?: () => void;
  onResume?: (sortOrder: number) => void;
  failedJobProgress?: WvpBatchCraftProgress | null;
};

export function BatchCraftProgressPanel({
  progress,
  busy,
  compact = false,
  queueHint,
  onCancel,
  onResume,
  failedJobProgress,
}: BatchCraftProgressPanelProps) {
  if (!progress && !failedJobProgress && !busy) return null;

  const active = progress ?? failedJobProgress;
  const eta = active ? estimateBatchRemainingMs(active) : null;
  const doneCount = active
    ? active.chapters.filter((ch) =>
        ["materialized", "skipped", "failed"].includes(ch.status),
      ).length
    : 0;
  const totalChapters = active?.totalChapters ?? 0;
  const percent =
    totalChapters > 0 ? Math.min(100, Math.round((doneCount / totalChapters) * 100)) : 0;
  const phaseLabel = active
    ? (BATCH_CRAFT_PHASE_LABEL[active.phase] ?? active.phase)
    : "啟動中";
  const currentTitle = active?.currentTitle?.trim();
  const chapterLabel =
    totalChapters > 0
      ? `第 ${Math.min((active?.currentChapterIndex ?? 0) + 1, totalChapters)}/${totalChapters} 章`
      : "";

  const firstFailed = failedJobProgress?.chapters.find((ch) => ch.status === "failed");

  const mapChapterStatus = (
    status: WvpBatchCraftChapterProgress["status"],
  ): CompactBatchItemStatus => {
    if (status === "materialized") return "done";
    if (status === "synced" || status === "generated") return "running";
    if (status === "skipped") return "skipped";
    if (status === "failed") return "failed";
    if (status === "running") return "running";
    return "pending";
  };

  if (compact) {
    const compactSource = active ?? failedJobProgress;
    return (
      <CompactBatchProgressPanel
        busy={busy}
        queueHint={queueHint}
        busyTitle="上次批次結果"
        onCancel={busy && onCancel ? () => onCancel() : undefined}
        onResume={
          !busy && firstFailed && onResume
            ? {
                label: `從「${firstFailed.title}」續跑`,
                onClick: () => onResume(firstFailed.sortOrder),
              }
            : undefined
        }
        estimateRemainingMs={
          compactSource ? () => estimateBatchRemainingMs(compactSource) : undefined
        }
        progress={
          compactSource
            ? {
                phaseLabel,
                currentIndex: compactSource.currentChapterIndex,
                totalItems: compactSource.totalChapters,
                currentLabel: currentTitle,
                itemUnit: "章",
                itemDurationsMs: compactSource.chapterDurationsMs,
                items: compactSource.chapters.map((ch) => ({
                  id: ch.wvpChapterId,
                  label: ch.title,
                  status: mapChapterStatus(ch.status),
                  error: ch.error,
                })),
              }
            : null
        }
      />
    );
  }

  if (!active) return null;

  return (
    <div className="mb-3 w-full space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-200">
          {busy ? "全課批次進行中" : "上次批次結果"}
        </p>
        {busy && onCancel ? (
          <button
            type="button"
            className="cf-btn cf-btn-secondary cf-btn-sm"
            onClick={() => onCancel()}
          >
            取消
          </button>
        ) : null}
        {!busy && firstFailed && onResume ? (
          <button
            type="button"
            className="cf-btn cf-btn-primary cf-btn-sm"
            onClick={() => onResume(firstFailed.sortOrder)}
          >
            從「{firstFailed.title}」續跑
          </button>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>
            {chapterLabel}
            {currentTitle ? ` · ${currentTitle}` : ""} · {phaseLabel}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        {busy ? (
          <p className="text-[11px] text-zinc-500">預估剩餘：{formatEtaMs(eta)}</p>
        ) : null}
      </div>

      <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-zinc-400">
        {active.chapters.map((ch) => (
          <li key={ch.wvpChapterId} className="flex items-start gap-2">
            <span className="w-4 shrink-0 text-center text-zinc-500">
              {CHAPTER_STATUS_ICON[ch.status]}
            </span>
            <span className="min-w-0 flex-1 truncate">{ch.title}</span>
            {ch.error ? (
              <span className="shrink-0 text-amber-500/90" title={ch.error}>
                失敗
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
