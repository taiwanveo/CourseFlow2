import {
  closeRedisConnection,
  createRedisConnection,
  isWorkerHeartbeatFresh,
} from "@courseflow/shared";

const PRESENCE_CACHE_MS = 10_000;
let presenceCache: { checkedAt: number; workerOnline: boolean } | null = null;

async function isWorkerOnline(): Promise<boolean> {
  const now = Date.now();
  if (presenceCache && now - presenceCache.checkedAt < PRESENCE_CACHE_MS) {
    return presenceCache.workerOnline;
  }

  const redis = createRedisConnection(undefined, { probe: true });
  try {
    await redis.connect();
    const workerOnline = await isWorkerHeartbeatFresh(redis);
    presenceCache = { checkedAt: now, workerOnline };
    return workerOnline;
  } catch {
    presenceCache = { checkedAt: now, workerOnline: false };
    return false;
  } finally {
    await closeRedisConnection(redis);
  }
}

/**
 * 是否將 TTS / 渲染任務寫入 BullMQ。
 * - 強制本機 inline：`COURSEFLOW_INLINE_JOBS=1`
 * - 強制佇列（略過心跳）：`COURSEFLOW_FORCE_QUEUE=1`
 * - 預設：有 REDIS_URL 且 Worker 心跳在線才入隊；否則 Web 走 inline（TTS）或回 503（MP4）
 */
export async function shouldUseJobQueue(): Promise<boolean> {
  if (process.env.COURSEFLOW_INLINE_JOBS === "1") return false;
  if (process.env.COURSEFLOW_FORCE_QUEUE === "1") return true;
  if (!process.env.REDIS_URL?.trim()) return false;
  return isWorkerOnline();
}
