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
