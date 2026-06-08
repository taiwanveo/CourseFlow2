import type IORedis from "ioredis";

/** Redis key：Worker 定期寫入，Web 用來判斷是否有消費者在線。 */
export const WORKER_HEARTBEAT_KEY = "courseflow-v2:worker:heartbeat";

/** 舊版 key（讀取時一併檢查，遷移過渡） */
export const WORKER_HEARTBEAT_KEY_LEGACY = "courseflow:worker:heartbeat";

/** 心跳 TTL（秒）；逾時未更新則視為無 Worker。 */
export const WORKER_HEARTBEAT_TTL_SEC = 45;

/** Worker 寫入心跳的間隔（毫秒）。 */
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;

export async function touchWorkerHeartbeat(redis: IORedis): Promise<void> {
  const ts = String(Date.now());
  await redis.set(WORKER_HEARTBEAT_KEY, ts, "EX", WORKER_HEARTBEAT_TTL_SEC);
  await redis.set(WORKER_HEARTBEAT_KEY_LEGACY, ts, "EX", WORKER_HEARTBEAT_TTL_SEC);
}

export async function isWorkerHeartbeatFresh(redis: IORedis): Promise<boolean> {
  const value = await redis.get(WORKER_HEARTBEAT_KEY);
  if (value != null) return true;
  const legacy = await redis.get(WORKER_HEARTBEAT_KEY_LEGACY);
  return legacy != null;
}

export async function readWorkerHeartbeatAgeMs(redis: IORedis): Promise<number | null> {
  const raw =
    (await redis.get(WORKER_HEARTBEAT_KEY)) ??
    (await redis.get(WORKER_HEARTBEAT_KEY_LEGACY));
  if (!raw) return null;
  const ts = Number.parseInt(raw, 10);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Date.now() - ts);
}
