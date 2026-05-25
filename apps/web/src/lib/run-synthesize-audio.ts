import type { CourseComposition } from "@courseflow/core";
import type { TtsProviderId } from "@courseflow/tts";
import { synthesizeSpeech } from "@courseflow/tts";
import { decryptApiKey } from "@/lib/crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { saveComposition } from "@/lib/project-composition";

async function synthesizeStepAudio(
  provider: TtsProviderId,
  text: string,
  voiceId: string,
  apiKey?: string,
  model?: string,
): Promise<Buffer> {
  return synthesizeSpeech(
    provider,
    text,
    voiceId,
    apiKey ? { provider, apiKey } : { provider },
    model ? { model } : undefined,
  );
}

export async function runSynthesizeAudio(payload: {
  projectId: string;
  userId: string;
  provider: TtsProviderId;
  voiceId: string;
  model?: string;
  stepIds?: string[];
}) {
  const supabase = createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("composition_snapshot")
    .eq("id", payload.projectId)
    .single();

  if (projectError) throw new Error(projectError.message);

  const composition = (project as { composition_snapshot?: CourseComposition })
    ?.composition_snapshot;
  if (!composition?.steps?.length) {
    throw new Error("專案沒有可合成的步驟");
  }

  let apiKey: string | undefined;
  if (payload.provider !== "edge-tts") {
    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", payload.userId)
      .eq("provider", payload.provider)
      .maybeSingle();
    const encrypted = (keyRow as { encrypted_key?: string } | null)?.encrypted_key;
    if (!encrypted) {
      throw new Error(`請先在設定頁填寫 ${payload.provider} API Key`);
    }
    apiKey = decryptApiKey(encrypted);
  }

  const audioEntries = [...composition.audio];
  const targetSteps = payload.stepIds?.length
    ? composition.steps.filter((step) => payload.stepIds!.includes(step.id))
    : composition.steps;

  for (const step of targetSteps) {
    if (!step.script.trim()) continue;

    const buffer = await synthesizeStepAudio(
      payload.provider,
      step.script,
      payload.voiceId,
      apiKey,
      payload.model,
    );

    const storagePath = `${payload.userId}/${payload.projectId}/audio/${step.id}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("courseflow-assets")
      .upload(storagePath, buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`音訊上傳失敗：${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from("courseflow-assets").getPublicUrl(storagePath);
    const entry = {
      stepId: step.id,
      storagePath,
      publicUrl: urlData.publicUrl,
      durationMs: step.estimatedSeconds ? step.estimatedSeconds * 1000 : 3000,
    };
    const index = audioEntries.findIndex((item) => item.stepId === step.id);
    if (index >= 0) audioEntries[index] = entry;
    else audioEntries.push(entry);
  }

  await saveComposition(supabase, payload.projectId, {
    ...composition,
    audio: audioEntries,
  });
}
