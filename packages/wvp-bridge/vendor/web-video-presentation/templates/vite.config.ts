import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Studio 內嵌預覽時由 prepare API 注入；一般 dev / 錄製維持 "/" */
const previewBase = process.env.CF_STUDIO_PREVIEW_BASE;

export default defineConfig({
  base: previewBase ?? "/",
  plugins: [react()],
  server: {
    port: 5174,
    fs: { allow: [".."] },
  },
});
