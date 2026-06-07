"use client";

import { formatEtaMs } from "@/lib/tts-batch-progress";

export type CompactBatchItemStatus = "pending" | "running" | "done" | "skipped" | "failed";

export type CompactBatchProgress = {
  phaseLabel: string;
  currentIndex: number;
  totalItems: number;
  currentLabel?: string;
  itemUnit: string;
  itemDurationsMs: number[];
  items: Array<{
    id: string;
    label: string;
    status: CompactBatchItemStatus;
  }>;
};

type CompactBatchProgressPanelProps = {
  progress: CompactBatchProgress | null;
  busy: boolean;
  queueHint?: string | null;
  busyTitle?: string;
  estimateRemainingMs?: (progress: CompactBatchProgress) => number | null;
  onCancel?: () => void;
  onResume?: { label: string; onClick: () => void };
};

const DONE_STATUSES = new Set<CompactBatchItemStatus>(["done", "skipped", "failed"]);

export function CompactBatchProgressPanel({
  progress,
  busy,
  queueHint,
  busyTitle = "批次進行中",
  estimateRemainingMs,
  onCancel,
  onResume,
}: CompactBatchProgressPanelProps) {
  if (!progress && !busy) return null;

  const doneCount = progress
    ? progress.items.filter((item) => DONE_STATUSES.has(item.status)).length
    : 0;
  const totalItems = progress?.totalItems ?? 0;
  const percent =
    totalItems > 0 ? Math.min(100, Math.round((doneCount / totalItems) * 100)) : 0;
  const phaseLabel = progress?.phaseLabel ?? "啟動中";
  const currentLabel = progress?.currentLabel?.trim();
  const itemLabel =
    totalItems > 0
      ? `第 ${Math.min((progress?.currentIndex ?? 0) + 1, totalItems)}/${totalItems} ${progress?.itemUnit ?? "項"}`
      : "";

  const eta =
    progress && estimateRemainingMs ? estimateRemainingMs(progress) : null;

  const statusLine = busy
    ? queueHint ??
      (progress
        ? `${itemLabel}${currentLabel ? ` · ${currentLabel}` : ""} · ${phaseLabel}`
        : "正在啟動批次…")
    : busyTitle;

  return (
    <div className="min-h-[2.75rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-zinc-400" title={statusLine}>
          {busy ? "⟳ " : ""}
          {statusLine}
        </p>
        <span className="shrink-0 text-[11px] font-medium text-emerald-500/90">{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${Math.max(busy && !progress ? 4 : percent, busy ? 4 : 0)}%` }}
        />
      </div>
      {busy && eta !== null ? (
        <p className="mt-1 text-[10px] text-zinc-600">預估剩餘 {formatEtaMs(eta)}</p>
      ) : null}
      {busy && onCancel ? (
        <button
          type="button"
          className="mt-1.5 text-[10px] text-zinc-500 underline hover:text-zinc-300"
          onClick={() => onCancel()}
        >
          取消批次
        </button>
      ) : null}
      {!busy && onResume ? (
        <button
          type="button"
          className="mt-1.5 text-[10px] text-emerald-500/90 underline hover:text-emerald-400"
          onClick={() => onResume.onClick()}
        >
          {onResume.label}
        </button>
      ) : null}
    </div>
  );
}

export function toCompactBatchProgress(
  input: {
    phaseLabel: string;
    currentIndex: number;
    totalItems: number;
    currentLabel?: string;
    itemUnit: string;
    itemDurationsMs: number[];
    items: Array<{ id: string; label: string; status: CompactBatchItemStatus }>;
  },
): CompactBatchProgress {
  return input;
}
