"use client";

import { formatEtaMs } from "@/lib/wvp-build-progress";

type FullWidthProgressPanelProps = {
  busy: boolean;
  label: string;
  percent: number;
  eta?: number | null;
  queueHint?: string | null;
};

export function FullWidthProgressPanel({
  busy,
  label,
  percent,
  eta = null,
  queueHint,
}: FullWidthProgressPanelProps) {
  if (!busy) return null;

  const statusLine = queueHint ?? label;
  const clampedPercent = Math.min(100, Math.max(busy ? 4 : 0, percent));

  return (
    <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-zinc-300" title={statusLine}>
          ⟳ {statusLine}
        </p>
        <span className="shrink-0 text-sm font-medium text-emerald-500/90">{clampedPercent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {eta !== null ? (
        <p className="mt-1.5 text-xs text-zinc-500">預估剩餘 {formatEtaMs(eta)}</p>
      ) : null}
    </div>
  );
}
