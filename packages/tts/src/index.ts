import type { TtsCredentials, TtsProvider, TtsProviderId, TtsVoice, TtsModel, ProjectLanguage, TtsSynthesizeOptions } from "./types.js";
import { edgeTtsVisibleForLanguage, EDGE_TTS_ZH_TW_VOICES, OPENAI_TTS_MODELS, OPENROUTER_TTS_MODELS, getTtsVoicesForModel } from "./types.js";
import { edgeTtsProvider } from "./edge-tts.js";
import {
  openAiTtsProvider,
  openRouterTtsProvider,
  geminiTtsProvider,
} from "./providers.js";

const PROVIDERS: Record<TtsProviderId, TtsProvider> = {
  "edge-tts": edgeTtsProvider,
  openai: openAiTtsProvider,
  gemini: geminiTtsProvider,
  openrouter: openRouterTtsProvider,
};

export function getTtsProvider(id: TtsProviderId): TtsProvider {
  return PROVIDERS[id];
}

export async function listAllVoices(
  language: ProjectLanguage,
  credentialsByProvider: Partial<Record<TtsProviderId, TtsCredentials>>,
): Promise<TtsVoice[]> {
  const voices: TtsVoice[] = [];

  for (const id of ["openai", "gemini", "openrouter"] as TtsProviderId[]) {
    const creds = credentialsByProvider[id];
    if (creds?.apiKey) {
      const provider = getTtsProvider(id);
      voices.push(...(await provider.listVoices(creds)));
    }
  }

  if (edgeTtsVisibleForLanguage(language)) {
    voices.push(...EDGE_TTS_ZH_TW_VOICES);
  }

  return voices;
}

export function listTtsModels(
  credentialsByProvider: Partial<Record<TtsProviderId, TtsCredentials>>,
): Partial<Record<TtsProviderId, TtsModel[]>> {
  const models: Partial<Record<TtsProviderId, TtsModel[]>> = {};
  if (credentialsByProvider.openai?.apiKey) {
    models.openai = OPENAI_TTS_MODELS;
  }
  if (credentialsByProvider.openrouter?.apiKey) {
    models.openrouter = OPENROUTER_TTS_MODELS;
  }
  return models;
}

export async function synthesizeSpeech(
  providerId: TtsProviderId,
  text: string,
  voiceId: string,
  credentials?: TtsCredentials,
  options?: TtsSynthesizeOptions,
): Promise<Buffer> {
  return getTtsProvider(providerId).synthesize(text, voiceId, credentials, options);
}

export * from "./types.js";
export { edgeTtsProvider } from "./edge-tts.js";
