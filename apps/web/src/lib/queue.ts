import { Queue } from "bullmq";
import { createRedisConnection, QUEUE_NAMES } from "@courseflow/shared";
import type IORedis from "ioredis";

export { QUEUE_NAMES };

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = createRedisConnection();
  }
  return connection;
}

/** 佇列連線失敗時釋放 singleton，避免後續請求沿用壞掉的 client */
export async function resetQueueConnection(): Promise<void> {
  if (!connection) return;
  const c = connection;
  connection = null;
  const { closeRedisConnection } = await import("@courseflow/shared");
  await closeRedisConnection(c);
}

export function getContentQueue() {
  return new Queue(QUEUE_NAMES.content, { connection: getConnection() });
}

export function getAudioQueue() {
  return new Queue(QUEUE_NAMES.audio, { connection: getConnection() });
}

export function getSubtitlesQueue() {
  return new Queue(QUEUE_NAMES.subtitles, { connection: getConnection() });
}

export function getVisualsQueue() {
  return new Queue(QUEUE_NAMES.visuals, { connection: getConnection() });
}

export function getRenderQueue() {
  return new Queue(QUEUE_NAMES.render, { connection: getConnection() });
}

export function getCraftQueue() {
  return new Queue(QUEUE_NAMES.craft, { connection: getConnection() });
}
