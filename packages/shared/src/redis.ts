import IORedis from "ioredis";

/** Upstash 等雲端 Redis 需 TLS；將 `redis://` 自動升級為 `rediss://`。 */
export function normalizeRedisUrl(url: string): string {
  if (url.startsWith("redis://") && url.includes("upstash.io")) {
    return url.replace("redis://", "rediss://");
  }
  return url;
}

export function createRedisConnection(url?: string): IORedis {
  const raw = url ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const normalized = normalizeRedisUrl(raw);
  const useTls = normalized.startsWith("rediss://");

  return new IORedis(normalized, {
    maxRetriesPerRequest: null,
    ...(useTls ? { tls: {} } : {}),
  });
}
