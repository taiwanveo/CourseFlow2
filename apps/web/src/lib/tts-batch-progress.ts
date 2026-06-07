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
  currentStepStartedAt?: string;
  startedAt: string;
  stepDurationsMs: number[];
  steps: TtsBatchStepProgress[];
};

/** 樣本不足時的保守預設（Edge-TTS 單步常需數秒～十數秒） */
const DEFAULT_TTS_STEP_MS = 10_000;
const MIN_TTS_STEP_MS = 6_000;

export function synthesizableTtsSteps(progress: TtsBatchProgress): TtsBatchStepProgress[] {
  return progress.steps.filter((s) => s.status !== "skipped");
}

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
  const synthSteps = synthesizableTtsSteps(progress);
  const pendingCount = synthSteps.filter((s) => s.status === "pending").length;
  const running = synthSteps.find((s) => s.status === "running");
  if (pendingCount === 0 && !running) return 0;

  const durations = progress.stepDurationsMs.filter((ms) => ms >= 500);
  let avgMs = DEFAULT_TTS_STEP_MS;
  if (durations.length > 0) {
    const rawAvg = durations.reduce((sum, ms) => sum + ms, 0) / durations.length;
    const sampleWeight = Math.min(durations.length / 3, 1);
    avgMs = Math.max(
      MIN_TTS_STEP_MS,
      rawAvg * sampleWeight + DEFAULT_TTS_STEP_MS * (1 - sampleWeight),
    );
  }

  let currentRemainMs = running ? avgMs : 0;
  if (running && progress.currentStepStartedAt) {
    const startedMs = Date.parse(progress.currentStepStartedAt);
    if (Number.isFinite(startedMs)) {
      const elapsed = Math.max(0, Date.now() - startedMs);
      currentRemainMs = Math.max(MIN_TTS_STEP_MS / 2, avgMs - elapsed);
    }
  }

  return Math.round(currentRemainMs + avgMs * pendingCount);
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
