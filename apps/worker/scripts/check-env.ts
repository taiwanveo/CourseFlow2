import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createRedisConnection } from "@courseflow/shared";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = path.resolve(workerRoot, "../..");

dotenv.config({ path: path.join(workerRoot, ".env") });

const webEnvPath = path.join(monorepoRoot, "apps/web/.env.local");
const webEnv = fs.existsSync(webEnvPath)
  ? dotenv.parse(fs.readFileSync(webEnvPath))
  : {};

const checks: { ok: boolean }[] = [];

function ok(name: string, detail?: string) {
  checks.push({ ok: true });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  checks.push({ ok: false });
  console.log(`✗ ${name}: ${detail}`);
}

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
  "API_KEY_ENCRYPTION_SECRET",
] as const;

for (const key of required) {
  const val = process.env[key];
  if (!val || val.includes("********") || val.includes("placeholder")) {
    fail(`env ${key}`, "未設定或仍為 placeholder");
  } else {
    ok(`env ${key}`, "已設定");
  }
}

if (webEnv.API_KEY_ENCRYPTION_SECRET && process.env.API_KEY_ENCRYPTION_SECRET) {
  if (webEnv.API_KEY_ENCRYPTION_SECRET === process.env.API_KEY_ENCRYPTION_SECRET) {
    ok("API_KEY_ENCRYPTION_SECRET 與 Web 一致");
  } else {
    fail("API_KEY_ENCRYPTION_SECRET 與 Web 一致", "兩邊值不同");
  }
}

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

try {
  const redis = createRedisConnection();
  const pong = await redis.ping();
  await redis.quit();
  if (pong === "PONG") ok("Redis 連線", "PONG");
  else fail("Redis 連線", `意外回應: ${pong}`);
} catch (e) {
  fail("Redis 連線", e instanceof Error ? e.message : String(e));
}

console.log("");
const failed = checks.filter((c) => !c.ok).length;
if (failed === 0) {
  console.log("全部檢查通過。");
  process.exit(0);
}
console.log(`${failed} 項未通過。`);
process.exit(1);
