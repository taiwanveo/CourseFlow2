/**
 * Web 端背景任務分流器。
 *
 * 這個模組只做一件事：回答「目前這個環境，是否應該把任務送進 BullMQ」。
 *
 * 之所以把邏輯集中在這裡，而不是散落在 API route 中，是因為這個決策同時受
 * 3 類因素影響：
 * 1. 明確的人工覆寫：`COURSEFLOW_INLINE_JOBS=1` / `COURSEFLOW_FORCE_QUEUE=1`
 * 2. 基礎設施是否存在：`REDIS_URL`
 * 3. Worker 是否真的在線：Redis heartbeat
 *
 * 若這裡判斷錯誤，正式環境可能把任務誤判成 inline，或本機開發時一直等待根本不存在的 Worker。
 */
import {
  closeRedisConnection,
  createRedisConnection,
  isWorkerHeartbeatFresh,
} from "@courseflow/shared";

const PRESENCE_CACHE_MS = 10_000;
let presenceCache: { checkedAt: number; workerOnline: boolean } | null = null;

/**
 * 探測 Worker heartbeat 是否仍在有效時間窗內。
 *
 * 這裡故意加上短暫快取，避免每次 API 呼叫都重新 connect Redis。
 * 對使用者而言，Worker 上下線狀態的 10 秒級延遲可接受，但頻繁建連線會直接增加 API 延遲與 Redis 壓力。
 */
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
 * 回答目前是否應將 TTS / 渲染任務寫入 BullMQ。
 *
 * 判斷順序是刻意設計的：
 * 1. `COURSEFLOW_INLINE_JOBS=1` 擁有最高優先權，通常用於本機或 emergency fallback。
 * 2. `COURSEFLOW_FORCE_QUEUE=1` 用於明確要求入隊，即使 heartbeat 尚未刷新也照樣送。
 * 3. 沒有 `REDIS_URL` 代表根本沒有佇列基礎設施，直接走 inline。
 * 4. 其餘情況才看 Worker heartbeat，避免任務被丟進無人消費的佇列。
 *
 * 備註：這個函式只回答「是否應入隊」，不負責建立 job，也不負責決定具體 queue name。
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

/**
 * MP4 / Playwright 錄製佇列判斷。
 * 不受 `COURSEFLOW_INLINE_JOBS` 影響——該旗標僅供 TTS 等輕量任務 Web inline；
 * 錄製需要 Chromium，僅 courseflow-worker 容器具備 Playwright。
 */
export async function shouldUseRenderQueue(): Promise<boolean> {
  if (process.env.COURSEFLOW_FORCE_QUEUE === "1") return true;
  if (!process.env.REDIS_URL?.trim()) return false;
  return isWorkerOnline();
}
