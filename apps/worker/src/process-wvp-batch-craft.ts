import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { LlmProviderId } from "@courseflow/llm";

export type WvpBatchCraftQueuePayload = {
  projectId: string;
  userId: string;
  jobRunId: string;
  provider?: LlmProviderId;
  onlyMissing: boolean;
  includeBuild: boolean;
  resumeFromSortOrder?: number;
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const webSrc = join(repoRoot, "apps/web/src");
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@": webSrc,
  },
});

export async function processWvpBatchCraft(payload: WvpBatchCraftQueuePayload): Promise<void> {
  console.log(
    `[wvp-batch-craft] worker picked job=${payload.jobRunId} project=${payload.projectId} onlyMissing=${payload.onlyMissing} includeBuild=${payload.includeBuild}`,
  );
  const mod = jiti(join(repoRoot, "apps/web/src/lib/run-wvp-batch-craft.ts")) as {
    runWvpBatchCraft: (p: WvpBatchCraftQueuePayload) => Promise<unknown>;
  };
  await mod.runWvpBatchCraft(payload);
  console.log(`[wvp-batch-craft] worker finished job=${payload.jobRunId} project=${payload.projectId}`);
}
