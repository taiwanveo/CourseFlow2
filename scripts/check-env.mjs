/**
 * 本地環境連線檢查（不輸出 secret 全文）
 * 用法：node scripts/check-env.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createRedisConnection } from "@courseflow/shared";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

const webEnv = loadEnvFile(path.join(root, "apps/web/.env.local"));
const workerEnv = loadEnvFile(path.join(root, "apps/worker/.env"));
const env = { ...workerEnv, ...webEnv };

for (const [k, v] of Object.entries(env)) {
  if (v) process.env[k] ??= v;
}

const checks = [];

function ok(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.log(`✗ ${name}: ${detail}`);
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
  "API_KEY_ENCRYPTION_SECRET",
];

for (const key of required) {
  const val = env[key] ?? process.env[key];
  if (!val || val.includes("********") || val.includes("placeholder")) {
    fail(`env ${key}`, "未設定或仍為 placeholder");
  } else {
    ok(`env ${key}`, "已設定");
  }
}

if (webEnv.API_KEY_ENCRYPTION_SECRET && workerEnv.API_KEY_ENCRYPTION_SECRET) {
  if (webEnv.API_KEY_ENCRYPTION_SECRET === workerEnv.API_KEY_ENCRYPTION_SECRET) {
    ok("API_KEY_ENCRYPTION_SECRET 一致");
  } else {
    fail("API_KEY_ENCRYPTION_SECRET 一致", "Web 與 Worker 值不同");
  }
}

const supabaseUrl = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseUrl && serviceKey) {
  try {
    const sb = createClient(supabaseUrl, serviceKey);
    const { error } = await sb.from("projects").select("id").limit(1);
    if (error?.code === "42P01") {
      fail("Supabase schema", "projects 表不存在，請執行 migration");
    } else if (error) {
      fail("Supabase 連線", error.message);
    } else {
      ok("Supabase 連線", "可讀取 projects 表");
    }
  } catch (e) {
    fail("Supabase 連線", e instanceof Error ? e.message : String(e));
  }
}

try {
  const redis = createRedisConnection(env.REDIS_URL);
  const pong = await redis.ping();
  await redis.quit();
  if (pong === "PONG") {
    ok("Redis 連線", "PONG");
  } else {
    fail("Redis 連線", `意外回應: ${pong}`);
  }
} catch (e) {
  fail("Redis 連線", e instanceof Error ? e.message : String(e));
}

const failed = checks.filter((c) => !c.ok);
console.log("");
if (failed.length === 0) {
  console.log("全部檢查通過，可啟動 Web + Worker。");
  process.exit(0);
} else {
  console.log(`${failed.length} 項未通過，請依上方訊息修正。`);
  process.exit(1);
}
