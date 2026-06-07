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

/** GPT-4o Mini TTS / GPT-4o Audio 擴展語音集（新增 ash / ballad / coral / sage / verse） */
export const OPENAI_TTS_VOICES_EXTENDED: TtsVoice[] = [
  { id: "alloy",   name: "Alloy",   language: "multi", gender: "neutral", provider: "openai" },
  { id: "ash",     name: "Ash",     language: "multi", gender: "male",    provider: "openai" },
  { id: "ballad",  name: "Ballad",  language: "multi", gender: "male",    provider: "openai" },
  { id: "coral",   name: "Coral",   language: "multi", gender: "female",  provider: "openai" },
  { id: "echo",    name: "Echo",    language: "multi", gender: "male",    provider: "openai" },
  { id: "fable",   name: "Fable",   language: "multi", gender: "male",    provider: "openai" },
  { id: "nova",    name: "Nova",    language: "multi", gender: "female",  provider: "openai" },
  { id: "onyx",    name: "Onyx",    language: "multi", gender: "male",    provider: "openai" },
  { id: "sage",    name: "Sage",    language: "multi", gender: "female",  provider: "openai" },
  { id: "shimmer", name: "Shimmer", language: "multi", gender: "female",  provider: "openai" },
  { id: "verse",   name: "Verse",   language: "multi", gender: "male",    provider: "openai" },
];

/**
 * 根據模型 ID 決定可用語音清單。
 * 自動將 provider 欄位套入返回的 TtsVoice 陣列。
 */
export function getTtsVoicesForModel(modelId: string, provider: TtsProviderId): TtsVoice[] {
  const id = modelId.toLowerCase();

  // Classic TTS-1 family — tts-1 / tts-1-hd，不含 audio / gpt-4o
  if (/(\/|^)(tts-1|tts-1-hd)(-|$)/.test(id)) {
    return OPENAI_TTS_VOICES.map((v) => ({ ...v, provider }));
  }

  // GPT Audio 家族：gpt-4o-audio / gpt-4o-mini-audio / gpt-audio / gpt-4.1-audio / o1-audio
  if (
    id.includes("gpt-4o") ||
    id.includes("gpt-4.1") ||
    id.includes("gpt-audio") ||
    (id.includes("o1") && id.includes("audio"))
  ) {
    return OPENAI_TTS_VOICES_EXTENDED.map((v) => ({ ...v, provider }));
  }

  // GPT-4o Mini TTS 或含有 tts 的 OpenAI 模型 — 擴展語音集
  if (id.includes("tts") && (id.includes("openai") || provider === "openai")) {
    return OPENAI_TTS_VOICES_EXTENDED.map((v) => ({ ...v, provider }));
  }

  // OpenRouter 上其他含 tts 的未知模型 — 預設擴展語音集
  if (id.includes("tts")) {
    return OPENAI_TTS_VOICES_EXTENDED.map((v) => ({ ...v, provider }));
  }

  // 預設：provider 本身的舊語音集
  return OPENAI_TTS_VOICES.map((v) => ({ ...v, provider }));
}

/**
 * OpenRouter 不提供 OpenAI `audio/speech` 端點（無 openai/tts-1 等模型）。
 * 語音合成請改用 OpenAI 直連 API Key 或 Edge-TTS。
 */
export const OPENROUTER_TTS_UNSUPPORTED_MESSAGE =
  "OpenRouter 不支援傳統 TTS（audio/speech）API。請在設定頁填寫 OpenAI API Key 並選「OpenAI」提供者，或改用 Edge-TTS（繁中）。";

export const OPENROUTER_KNOWN_TTS_MODEL_IDS: readonly string[] = [];

export const OPENROUTER_TTS_MODELS: TtsModel[] = [];

export const OPENROUTER_DEFAULT_TTS_MODEL = "";

const LEGACY_OPENROUTER_MODEL_MAP: Record<string, string> = {
  "openai/gpt-4o-mini-tts-2025-12-15": "",
  "openai/tts-1": "",
  "openai/tts-1-hd": "",
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
    if (model && LEGACY_OPENROUTER_MODEL_MAP[model]) {
      const mapped = LEGACY_OPENROUTER_MODEL_MAP[model];
      if (mapped) return mapped;
    }
    return undefined;
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
