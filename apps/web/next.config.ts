import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(webRoot, "../..");

const nextConfig: NextConfig = {
  // Windows 本機常因未啟用 symlink 權限而在 standalone 失敗（EPERM）。
  // Render（Linux）仍保留 standalone，利於 Docker 佈署。
  output: process.platform === "win32" ? undefined : "standalone",
  // pnpm monorepo：讓 standalone 能追蹤到 workspace 根目錄的 node_modules（含 edge-tts-universal）
  outputFileTracingRoot: monorepoRoot,
  // WVP scaffold／主題 API 以 fs 讀 vendor，需手動納入 standalone trace
  outputFileTracingIncludes: {
    "/*": ["./packages/wvp-bridge/vendor/web-video-presentation/**/*"],
  },
  transpilePackages: [
    "@courseflow/core",
    "@courseflow/db",
    "@courseflow/shared",
    "@courseflow/composition",
    "@courseflow/llm",
    "@courseflow/wvp-bridge",
    "@courseflow/hf-bridge",
    "@courseflow/player",
    "@courseflow/wvp-bridge",
    "@courseflow/craft-agent",
    "openai",
  ],
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "@supabase/supabase-js",
    "@supabase/ssr",
    "bullmq",
    "ioredis",
    "edge-tts-universal",
    "@courseflow/tts",
    "playwright",
    "playwright-core",
    "@courseflow/presentation",
  ],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    if (isServer) {
      // 避免 Next/Webpack 嘗試打包 Playwright 的可選依賴（electron、ws native addons）。
      // 這些在執行期（Node）由 require 解析即可，且不影響 Render（Linux）環境。
      config.externals = [
        ...(config.externals ?? []),
        {
          playwright: "commonjs playwright",
          "playwright-core": "commonjs playwright-core",
          electron: "commonjs electron",
          "electron/index.js": "commonjs electron/index.js",
          bufferutil: "commonjs bufferutil",
          "utf-8-validate": "commonjs utf-8-validate",
          fsevents: "commonjs fsevents",
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
