import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(webRoot, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  // pnpm monorepo：讓 standalone 能追蹤到 workspace 根目錄的 node_modules（含 edge-tts-universal）
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@courseflow/core",
    "@courseflow/db",
    "@courseflow/composition",
    "@courseflow/llm",
    "@courseflow/wvp-bridge",
    "@courseflow/hf-bridge",
    "@courseflow/player",
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
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
