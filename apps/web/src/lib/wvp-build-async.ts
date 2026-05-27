/**
 * Render / 多數 PaaS 的 HTTP 閘道逾時約 30s，完整 Vite 打包必須背景執行（job_runs + 輪詢）。
 * 本機同步打包：COURSEFLOW_INLINE_WVP_BUILD=1
 */
export function shouldAsyncWvpBuild(): boolean {
  if (process.env.COURSEFLOW_INLINE_WVP_BUILD === "1") return false;
  if (process.env.COURSEFLOW_ASYNC_WVP_BUILD === "1") return true;
  if (process.env.RENDER === "true") return true;
  // Docker 生產映像（render.yaml 未注入 RENDER 時仍走非同步）
  if (process.env.NODE_ENV === "production") return true;
  return false;
}
