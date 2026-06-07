const DEFAULT_BATCH_CONCURRENCY = 3;

export function resolveBatchConcurrency(): number {
  const raw = process.env.WVP_BATCH_CONCURRENCY;
  const parsed = raw ? Number(raw) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.min(4, Math.floor(parsed));
  }
  return DEFAULT_BATCH_CONCURRENCY;
}

export function shouldBatchVisualDirector(): boolean {
  if (process.env.WVP_BATCH_VISUAL_DIRECTOR === "0") return false;
  return true;
}
