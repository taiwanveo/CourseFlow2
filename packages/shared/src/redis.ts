import IORedis from "ioredis";

/** Upstash 等雲端 Redis 需 TLS；將 `redis://` 自動升級為 `rediss://`。 */
export function normalizeRedisUrl(url: string): string {
  if (url.startsWith("redis://") && url.includes("upstash.io")) {
    return url.replace("redis://", "rediss://");
  }
  return url;
}

export interface CreateRedisOptions {
  /**
   * 短連線探測（例如 Web 判斷 Worker 是否在線）：
   * 不重試、不離線佇列，並註冊 error handler 避免 dev 主控台洗版。
   */
  probe?: boolean;
}

function attachRedisErrorHandler(client: IORedis): IORedis {
  if ((client as IORedis & { __cfErrorHandler?: boolean }).__cfErrorHandler) {
    return client;
  }
  client.on("error", () => {
    /* ioredis 在連線失敗時會 emit error；必須有 listener 才不會變成 Unhandled error event */
  });
  (client as IORedis & { __cfErrorHandler?: boolean }).__cfErrorHandler = true;
  return client;
}

export async function closeRedisConnection(client: IORedis): Promise<void> {
  try {
    if (client.status === "ready" || client.status === "connect") {
      await client.quit();
      return;
    }
  } catch {
    /* ignore */
  }
  client.disconnect();
}

export function createRedisConnection(
  url?: string,
  options?: CreateRedisOptions,
): IORedis {
  const probe = options?.probe ?? false;
  const raw = url ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const normalized = normalizeRedisUrl(raw);
  const useTls = normalized.startsWith("rediss://");

  const client = new IORedis(normalized, {
    maxRetriesPerRequest: probe ? 1 : null,
    connectTimeout: probe ? 2500 : 10_000,
    enableOfflineQueue: !probe,
    lazyConnect: probe,
    retryStrategy: probe ? () => null : (times) => Math.min(times * 200, 2000),
    ...(useTls ? { tls: {} } : {}),
  });

  return attachRedisErrorHandler(client);
}
