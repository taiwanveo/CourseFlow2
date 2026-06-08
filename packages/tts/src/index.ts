import type { TtsCredentials, TtsProvider, TtsProviderId, TtsVoice, TtsModel, ProjectLanguage, TtsSynthesizeOptions } from "./types.js";
import { filterChineseTtsModelsWithVoices, filterChineseVoices } from "./chinese-tts.js";
import {
  edgeTtsVisibleForLanguage,
  edgeTtsVoicesForLanguage,
  getTtsVoicesForModel,
  OPENAI_TTS_MODELS,
} from "./types.js";
import { fetchOpenRouterTtsCatalog } from "./openrouter-tts.js";
import { edgeTtsProvider } from "./edge-tts.js";
import {
  openAiTtsProvider,
  openRouterTtsProvider,
  geminiTtsProvider,
} from "./providers.js";

/**
 * TTS 入口層。
 *
 * 這裡特別重要的一點是：CourseFlow v2 的「生成語音」沒有獨立 system prompt。
 * TTS 階段拿到的是前一階段已生成好的 `script` 純文字，然後直接交給各 provider 合成語音。
 *
 * 所以如果你未來想改：
 * - 說話內容是什麼 → 改 `SCRIPT_SYSTEM_PROMPT` 或 `MARKDOWN_TO_COURSE_SYSTEM_PROMPT`
 * - 聲音是誰、模型是哪個、支援哪些 provider → 改這個檔案與 provider 實作
 */
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
    voices.push(...edgeTtsVoicesForLanguage(language));
  }

  return filterChineseVoices(voices);
}

export async function listTtsModels(
  credentialsByProvider: Partial<Record<TtsProviderId, TtsCredentials>>,
): Promise<Partial<Record<TtsProviderId, TtsModel[]>>> {
  const models: Partial<Record<TtsProviderId, TtsModel[]>> = {};
  if (credentialsByProvider.openai?.apiKey) {
    models.openai = filterChineseTtsModelsWithVoices(OPENAI_TTS_MODELS, (modelId, provider) =>
      filterChineseVoices(getTtsVoicesForModel(modelId, provider)),
    );
  }
  if (credentialsByProvider.openrouter?.apiKey) {
    try {
      models.openrouter = await fetchOpenRouterTtsCatalog(
        credentialsByProvider.openrouter.apiKey,
      );
    } catch {
      models.openrouter = [];
    }
  }
  return models;
}

/**
 * 真正執行 TTS 合成。
 *
 * 這裡接收的 `text` 就是最終會被念出的內容，不會再經過任何 LLM prompt 改寫。
 * 因此語音內容要改字句，不能改這裡，要回去改上游文字生成 prompt。
 */
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
export {
  filterChineseVoices,
  filterChineseTtsModelsWithVoices,
  formatVoiceLabel,
  voiceIdSupportsChinese,
} from "./chinese-tts.js";
export { edgeTtsProvider } from "./edge-tts.js";
export {
  fetchOpenRouterSpeechModels,
  fetchOpenRouterTtsCatalog,
  openRouterTtsRouteForModel,
  openRouterTtsRouteForRow,
  synthesizeOpenRouterSpeech,
} from "./openrouter-tts.js";
