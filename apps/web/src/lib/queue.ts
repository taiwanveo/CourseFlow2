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
