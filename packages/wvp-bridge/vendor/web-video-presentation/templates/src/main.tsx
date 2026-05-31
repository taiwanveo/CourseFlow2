import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

/**
 * Vite presentation 的前端掛載入口。
 *
 * 模板客製化通常不需要改這裡；只有在你要替整個 presentation 換掉根組件或加全域 provider 時才會碰。
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
