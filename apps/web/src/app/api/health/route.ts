import { NextResponse } from "next/server";
import { createRedisConnection, isWorkerHeartbeatFresh, readWorkerHeartbeatAgeMs } from "@courseflow/shared";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type HealthCheck = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

export async function GET() {
  const buildSha = process.env.COURSEFLOW_BUILD_SHA?.trim() || "unknown";
  const checks: Record<string, HealthCheck> = {};

  const supabaseStart = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("projects").select("id").limit(1);
    checks.supabase = {
      ok: !error,
      latencyMs: Date.now() - supabaseStart,
      error: error?.message,
    };
  } catch (e) {
    checks.supabase = {
      ok: false,
      latencyMs: Date.now() - supabaseStart,
      error: e instanceof Error ? e.message : "supabase unreachable",
    };
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    const redisStart = Date.now();
    let redis: ReturnType<typeof createRedisConnection> | null = null;
    try {
      redis = createRedisConnection();
      await redis.ping();
      checks.redis = { ok: true, latencyMs: Date.now() - redisStart };
    } catch (e) {
      checks.redis = {
        ok: false,
        latencyMs: Date.now() - redisStart,
        error: e instanceof Error ? e.message : "redis unreachable",
      };
    }

    if (redis && checks.redis.ok) {
      try {
        const fresh = await isWorkerHeartbeatFresh(redis);
        const ageMs = await readWorkerHeartbeatAgeMs(redis);
        checks.worker = {
          ok: fresh,
          latencyMs: ageMs ?? undefined,
          error: fresh ? undefined : "worker heartbeat stale or missing",
        };
      } catch (e) {
        checks.worker = {
          ok: false,
          error: e instanceof Error ? e.message : "worker check failed",
        };
      }
    }
    try {
      await redis?.quit();
    } catch {
      /* ignore */
    }
  } else {
    checks.redis = { ok: false, error: "REDIS_URL not configured" };
    checks.worker = { ok: false, error: "skipped (no redis)" };
  }

  const allOk =
    checks.supabase?.ok !== false &&
    (checks.redis?.ok !== false || !redisUrl) &&
    (checks.worker?.ok !== false || process.env.COURSEFLOW_INLINE_JOBS === "1");

  return NextResponse.json(
    {
      ok: allOk,
      service: "courseflow-v2-web",
      buildSha,
      edition: process.env.COURSEFLOW_EDITION?.trim() || "v2",
      timestamp: new Date().toISOString(),
      checks,
      workerOnline: checks.worker?.ok === true,
      workerHeartbeatAgeMs: checks.worker?.latencyMs,
    },
    {
      status: allOk ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
