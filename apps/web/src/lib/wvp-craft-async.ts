/**
 * 視覺動效產生（試執行第 1 章 / 全課批次）在雲端常超過 HTTP 閘道逾時。
 * 生產環境預設走背景 job_runs；本機可用 COURSEFLOW_INLINE_WVP_CRAFT=1 強制同步。
 */
export function shouldAsyncWvpCraftJobs(): boolean {
  if (process.env.COURSEFLOW_INLINE_WVP_CRAFT === "1") return false;
  if (process.env.COURSEFLOW_ASYNC_WVP_CRAFT === "1") return true;
  if (process.env.RENDER === "true") return true;
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

const DEFAULT_TRIAL_JOB_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_JOB_STALE_MS = 16 * 60 * 1000;

/** 背景試執行／打包任務的總逾時（毫秒） */
export function resolveTrialJobTimeoutMs(): number {
  const raw = process.env.COURSEFLOW_TRIAL_JOB_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TRIAL_JOB_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

/**
 * job_runs 多久未更新視為僵死（應略大於試執行逾時，避免 Vite 打包期間被誤判）。
 */
export function resolveJobStaleMs(): number {
  const raw = process.env.COURSEFLOW_JOB_STALE_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return Math.max(DEFAULT_JOB_STALE_MS, resolveTrialJobTimeoutMs() + 60_000);
}

/**
 * @deprecated 試執行已固定跳過 generateChapterCraft，改由 applyChapterTemplate 產出螢幕文字。
 * 保留供舊環境變數相容；不再影響試執行流程。
 */
export function shouldTrialFastPath(): boolean {
  return true;
}

export { resolveBatchConcurrency, shouldBatchVisualDirector } from "@courseflow/wvp-craft";
