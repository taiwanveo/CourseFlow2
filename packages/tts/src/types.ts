export type ProjectLanguage = "zh-TW" | "zh-CN" | "en" | string;

export type TtsProviderId =
  | "edge-tts"
  | "openai"
  | "gemini"
  | "openrouter";

export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  gender?: "male" | "female" | "neutral";
  provider: TtsProviderId;
}

export interface TtsModel {
  id: string;
  name: string;
  provider: TtsProviderId;
}

export interface TtsSynthesizeOptions {
  model?: string;
}

export interface TtsCredentials {
  provider: TtsProviderId;
  apiKey?: string;
}

export interface TtsProvider {
  id: TtsProviderId;
  requiresApiKey: boolean;
  listVoices(credentials?: TtsCredentials): Promise<TtsVoice[]>;
  synthesize(
    text: string,
    voiceId: string,
    credentials?: TtsCredentials,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer>;
}

/** Edge-TTS 繁體中文固定語音（下拉選單末端） */
export const EDGE_TTS_ZH_TW_VOICES: TtsVoice[] = [
  {
    id: "zh-TW-HsiaoChenNeural",
    name: "曉臻（女聲）",
    language: "zh-TW",
    gender: "female",
    provider: "edge-tts",
  },
  {
    id: "zh-TW-YunJheNeural",
    name: "雲哲（男聲）",
    language: "zh-TW",
    gender: "male",
    provider: "edge-tts",
  },
];

export function edgeTtsVisibleForLanguage(language: string): boolean {
  return language === "zh-TW" || language.startsWith("zh-TW");
}

/** OpenAI / OpenRouter 共用語音（含性別標示） */
export const OPENAI_TTS_VOICES: TtsVoice[] = [
  { id: "alloy", name: "Alloy", language: "multi", gender: "neutral", provider: "openai" },
  { id: "echo", name: "Echo", language: "multi", gender: "male", provider: "openai" },
  { id: "fable", name: "Fable", language: "multi", gender: "male", provider: "openai" },
  { id: "onyx", name: "Onyx", language: "multi", gender: "male", provider: "openai" },
  { id: "nova", name: "Nova", language: "multi", gender: "female", provider: "openai" },
  { id: "shimmer", name: "Shimmer", language: "multi", gender: "female", provider: "openai" },
];

export const OPENAI_TTS_MODELS: TtsModel[] = [
  { id: "tts-1", name: "TTS-1", provider: "openai" },
  { id: "tts-1-hd", name: "TTS-1 HD", provider: "openai" },
];

export const OPENROUTER_TTS_MODELS: TtsModel[] = [
  {
    id: "openai/gpt-4o-mini-tts-2025-12-15",
    name: "GPT-4o Mini TTS",
    provider: "openrouter",
  },
  {
    id: "mistralai/voxtral-mini-tts-2603",
    name: "Voxtral Mini TTS",
    provider: "openrouter",
  },
];

export const OPENROUTER_DEFAULT_TTS_MODEL = OPENROUTER_TTS_MODELS[0]!.id;

const LEGACY_OPENROUTER_MODEL_MAP: Record<string, string> = {
  "tts-1": OPENROUTER_DEFAULT_TTS_MODEL,
  "tts-1-hd": OPENROUTER_DEFAULT_TTS_MODEL,
  "openai/tts-1": OPENROUTER_DEFAULT_TTS_MODEL,
  "openai/tts-1-hd": OPENROUTER_DEFAULT_TTS_MODEL,
};

export function resolveTtsModel(provider: TtsProviderId, model?: string): string | undefined {
  if (provider === "edge-tts" || provider === "gemini") return undefined;

  if (provider === "openai") {
    if (model && OPENAI_TTS_MODELS.some((item) => item.id === model)) return model;
    if (model?.startsWith("openai/")) return "tts-1";
    return model ?? "tts-1";
  }

  if (provider === "openrouter") {
    if (model && OPENROUTER_TTS_MODELS.some((item) => item.id === model)) return model;
    if (model && LEGACY_OPENROUTER_MODEL_MAP[model]) return LEGACY_OPENROUTER_MODEL_MAP[model];
    return OPENROUTER_DEFAULT_TTS_MODEL;
  }

  return model;
}

export function formatVoiceLabel(voice: TtsVoice): string {
  const genderLabel =
    voice.gender === "male"
      ? "男聲"
      : voice.gender === "female"
        ? "女聲"
        : voice.gender === "neutral"
          ? "中性"
          : null;
  return genderLabel ? `${voice.name}（${genderLabel}）` : voice.name;
}
