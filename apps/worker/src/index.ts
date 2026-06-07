import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(workerRoot, ".env") });

import { Worker } from "bullmq";
import {
  createRedisConnection,
  QUEUE_NAMES,
  touchWorkerHeartbeat,
  WORKER_HEARTBEAT_INTERVAL_MS,
} from "@courseflow/shared";
import { processRender } from "./processors.js";
import { processSynthesizeAudio } from "./process-synthesize-audio.js";
import { processWvpBatchCraft } from "./process-wvp-batch-craft.js";

async function main() {
  const connection = createRedisConnection();

  const publishHeartbeat = () => {
    touchWorkerHeartbeat(connection).catch((err) => {
      console.error("[worker] 心跳寫入失敗:", err);
    });
  };
  publishHeartbeat();
  setInterval(publishHeartbeat, WORKER_HEARTBEAT_INTERVAL_MS);

  new Worker(
    QUEUE_NAMES.audio,
    async (job) => {
      if (job.name === "synthesize") await processSynthesizeAudio(job.data);
    },
    { connection },
  );

  const renderWorker = new Worker(
    QUEUE_NAMES.render,
    async (job) => {
      if (job.name === "render") await processRender(job.data);
    },
    { connection },
  );

  renderWorker.on("failed", (job, err) => {
    console.error(`[render] 佇列任務失敗 ${job?.id ?? "?"}:`, err?.message ?? err);
  });

  const craftWorker = new Worker(
    QUEUE_NAMES.craft,
    async (job) => {
      if (
        job.name === "wvp-batch-craft" ||
        job.name === "wvp-batch-craft-build"
      ) {
        console.log(`[craft] dequeue ${job.name} id=${job.id ?? "?"}`);
        await processWvpBatchCraft(job.data);
      }
    },
    { connection },
  );

  craftWorker.on("failed", (job, err) => {
    console.error(`[craft] 佇列任務失敗 ${job?.id ?? "?"}:`, err?.message ?? err);
  });

  console.log("CourseFlow worker 已啟動（含 craft 佇列）");
}

main().catch(console.error);
