import type IORedis from "ioredis";

/** Redis key：Worker 定期寫入，Web 用來判斷是否有消費者在線。 */
export const WORKER_HEARTBEAT_KEY = "courseflow:worker:heartbeat";

/** 心跳 TTL（秒）；逾時未更新則視為無 Worker。 */
export const WORKER_HEARTBEAT_TTL_SEC = 45;

/** Worker 寫入心跳的間隔（毫秒）。 */
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;

export async function touchWorkerHeartbeat(redis: IORedis): Promise<void> {
  await redis.set(WORKER_HEARTBEAT_KEY, String(Date.now()), "EX", WORKER_HEARTBEAT_TTL_SEC);
}

export async function isWorkerHeartbeatFresh(redis: IORedis): Promise<boolean> {
  const value = await redis.get(WORKER_HEARTBEAT_KEY);
  return value != null;
}
