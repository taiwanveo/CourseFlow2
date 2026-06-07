import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { TtsProviderId } from "@courseflow/tts";

export type SynthesizeAudioQueuePayload = {
  projectId: string;
  userId: string;
  provider: TtsProviderId;
  voiceId: string;
  model?: string;
  stepIds?: string[];
  jobRunId?: string;
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const webSrc = join(repoRoot, "apps/web/src");
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@": webSrc,
  },
});

export async function processSynthesizeAudio(payload: SynthesizeAudioQueuePayload): Promise<void> {
  console.log(
    `[tts-batch] worker picked job=${payload.jobRunId ?? "?"} project=${payload.projectId} steps=${payload.stepIds?.length ?? "all"}`,
  );
  const mod = jiti(join(repoRoot, "apps/web/src/lib/run-synthesize-audio.ts")) as {
    runSynthesizeAudio: (p: SynthesizeAudioQueuePayload) => Promise<unknown>;
  };
  await mod.runSynthesizeAudio(payload);
  console.log(`[tts-batch] worker finished job=${payload.jobRunId ?? "?"}`);
}
