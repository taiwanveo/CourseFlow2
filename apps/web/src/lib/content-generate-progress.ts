import type { CompactBatchProgress } from "@/components/CompactBatchProgressPanel";
import type { CompactBatchItemStatus } from "@/components/CompactBatchProgressPanel";

export const CONTENT_GENERATE_PHASES = [
  { id: "analyze", label: "分析文稿" },
  { id: "outline", label: "生成大綱" },
  { id: "narration", label: "撰寫口播稿" },
  { id: "save", label: "儲存課程" },
] as const;

export function toContentGenerateCompactProgress(phaseIndex: number): CompactBatchProgress {
  const clamped = Math.max(0, Math.min(phaseIndex, CONTENT_GENERATE_PHASES.length - 1));
  const phase = CONTENT_GENERATE_PHASES[clamped]!;
  const items = CONTENT_GENERATE_PHASES.map((step, idx) => {
    let status: CompactBatchItemStatus = "pending";
    if (idx < clamped) status = "done";
    else if (idx === clamped) status = "running";
    return { id: step.id, label: step.label, status };
  });

  return {
    phaseLabel: phase.label,
    currentIndex: clamped,
    totalItems: CONTENT_GENERATE_PHASES.length,
    currentLabel: phase.label,
    itemUnit: "步驟",
    itemDurationsMs: [],
    items,
  };
}

/** 同步 API 無伺服器進度時，依耗時推進顯示階段 */
export function estimateContentGeneratePhaseIndex(elapsedMs: number): number {
  if (elapsedMs < 8_000) return 0;
  if (elapsedMs < 25_000) return 1;
  if (elapsedMs < 55_000) return 2;
  return 3;
}
