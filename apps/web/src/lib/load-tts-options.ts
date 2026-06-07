import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey } from "@/lib/crypto";
import {
  edgeTtsVisibleForLanguage,
  listAllVoices,
  listTtsModels,
  type TtsModel,
  type TtsProviderId,
  type TtsVoice,
} from "@courseflow/tts";

/** 語音合成可用的 API Key 提供者（OpenRouter 不支援 audio/speech，故排除） */
const KEY_PROVIDERS = ["openai", "gemini"] as const;

export type TtsOptionsPayload = {
  voices: TtsVoice[];
  models: Partial<Record<TtsProviderId, TtsModel[]>>;
  providers: TtsProviderId[];
};

export async function loadTtsOptionsForUser(
  supabase: SupabaseClient,
  userId: string,
  language: string,
): Promise<TtsOptionsPayload> {
  const { data: keys } = await supabase
    .from("user_api_keys")
    .select("provider, encrypted_key")
    .eq("user_id", userId);

  const credentialsByProvider: Partial<
    Record<TtsProviderId, { provider: TtsProviderId; apiKey?: string }>
  > = {};

  for (const row of keys ?? []) {
    const provider = row.provider as TtsProviderId;
    if (!KEY_PROVIDERS.includes(provider as (typeof KEY_PROVIDERS)[number])) continue;
    try {
      credentialsByProvider[provider] = {
        provider,
        apiKey: decryptApiKey(row.encrypted_key),
      };
    } catch {
      /* 略過無法解密的 Key */
    }
  }

  const voices = await listAllVoices(language, credentialsByProvider);
  const models = listTtsModels(credentialsByProvider);

  const providers: TtsProviderId[] = [];
  if (edgeTtsVisibleForLanguage(language)) providers.push("edge-tts");
  for (const provider of KEY_PROVIDERS) {
    if (credentialsByProvider[provider]?.apiKey) providers.push(provider);
  }

  return { voices, models, providers };
}
