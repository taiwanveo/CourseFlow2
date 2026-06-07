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
  const mod = jiti(join(repoRoot, "apps/web/src/lib/run-wvp-batch-craft.ts")) as {
    runWvpBatchCraft: (p: WvpBatchCraftQueuePayload) => Promise<unknown>;
  };
  await mod.runWvpBatchCraft(payload);
}
