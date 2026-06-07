export type TtsBatchStepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export type TtsBatchStepProgress = {
  stepId: string;
  label: string;
  sortOrder: number;
  status: TtsBatchStepStatus;
  error?: string;
};

export type TtsBatchProgress = {
  phase: "synthesize" | "done";
  currentStepIndex: number;
  totalSteps: number;
  currentStepId?: string;
  currentLabel?: string;
  startedAt: string;
  stepDurationsMs: number[];
  steps: TtsBatchStepProgress[];
};

export type TtsSynthesizeJobResult = {
  ok: boolean;
  progress?: TtsBatchProgress;
  summary: {
    total: number;
    done: number;
    failed: number;
    skipped: number;
  };
};

export const TTS_BATCH_PHASE_LABEL: Record<TtsBatchProgress["phase"], string> = {
  synthesize: "合成語音",
  done: "完成",
};

export function stepLabelFromScript(script: string, sortOrder: number): string {
  const trimmed = script.trim();
  if (!trimmed) return `步驟 ${sortOrder + 1}（空稿）`;
  const oneLine = trimmed.replace(/\s+/g, " ");
  return oneLine.length > 36 ? `${oneLine.slice(0, 36)}…` : oneLine;
}

export function createInitialTtsBatchProgress(
  steps: Array<{ stepId: string; label: string; sortOrder: number; hasScript: boolean }>,
): TtsBatchProgress {
  return {
    phase: "synthesize",
    currentStepIndex: 0,
    totalSteps: steps.length,
    startedAt: new Date().toISOString(),
    stepDurationsMs: [],
    steps: steps.map((s) => ({
      stepId: s.stepId,
      label: s.label,
      sortOrder: s.sortOrder,
      status: s.hasScript ? "pending" : "skipped",
    })),
  };
}

export function estimateTtsBatchRemainingMs(progress: TtsBatchProgress): number | null {
  const { stepDurationsMs, steps, totalSteps } = progress;
  if (stepDurationsMs.length === 0) return null;
  const avg = stepDurationsMs.reduce((sum, ms) => sum + ms, 0) / stepDurationsMs.length;
  const doneCount = steps.filter((s) => ["done", "skipped", "failed"].includes(s.status)).length;
  const remaining = Math.max(0, totalSteps - doneCount);
  return Math.round(avg * remaining);
}

export function formatEtaMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "計算中…";
  if (ms < 60_000) return `約 ${Math.max(1, Math.round(ms / 1000))} 秒`;
  const minutes = Math.ceil(ms / 60_000);
  return `約 ${minutes} 分鐘`;
}

export function parseTtsBatchProgress(raw: unknown): TtsBatchProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const progress = (raw as { progress?: unknown }).progress;
  if (!progress || typeof progress !== "object") return null;
  const p = progress as TtsBatchProgress;
  if (!Array.isArray(p.steps) || typeof p.totalSteps !== "number") return null;
  return p;
}
