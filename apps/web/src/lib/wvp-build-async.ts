/** Render 等環境 HTTP 請求逾時約 30s，完整 Vite 打包需改背景執行 */
export function shouldAsyncWvpBuild(): boolean {
  if (process.env.COURSEFLOW_INLINE_WVP_BUILD === "1") return false;
  if (process.env.COURSEFLOW_ASYNC_WVP_BUILD === "1") return true;
  return process.env.RENDER === "true";
}
