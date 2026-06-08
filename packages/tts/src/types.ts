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
  /** OpenRouter 等提供者：各模型專屬語音清單 */
  voices?: TtsVoice[];
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

/** Edge-TTS 繁體中文語音 */
export const EDGE_TTS_ZH_TW_VOICES: TtsVoice[] = [
  {
    id: "zh-TW-HsiaoChenNeural",
    name: "曉臻",
    language: "zh-TW",
    gender: "female",
    provider: "edge-tts",
  },
  {
    id: "zh-TW-YunJheNeural",
    name: "雲哲",
    language: "zh-TW",
    gender: "male",
    provider: "edge-tts",
  },
];

/** Edge-TTS 簡體中文語音 */
export const EDGE_TTS_ZH_CN_VOICES: TtsVoice[] = [
  {
    id: "zh-CN-XiaoxiaoNeural",
    name: "晓晓",
    language: "zh-CN",
    gender: "female",
    provider: "edge-tts",
  },
  {
    id: "zh-CN-YunxiNeural",
    name: "云希",
    language: "zh-CN",
    gender: "male",
    provider: "edge-tts",
  },
];

export function edgeTtsVisibleForLanguage(language: string): boolean {
  return language.startsWith("zh");
}

export function edgeTtsVoicesForLanguage(language: string): TtsVoice[] {
  if (language === "zh-CN" || language.startsWith("zh-CN")) {
    return EDGE_TTS_ZH_CN_VOICES;
  }
  if (language.startsWith("zh")) {
    return EDGE_TTS_ZH_TW_VOICES;
  }
  return [];
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

  // OpenRouter 上其他含 tts / audio / speech 的模型 — 預設擴展語音集
  if (id.includes("tts") || id.includes("audio") || id.includes("speech")) {
    return OPENAI_TTS_VOICES_EXTENDED.map((v) => ({ ...v, provider }));
  }

  return OPENAI_TTS_VOICES.map((v) => ({ ...v, provider }));
}

/** 舊版幽靈模型 ID → 清除（改由動態 speech 模型清單取代） */
const LEGACY_OPENROUTER_MODEL_IDS = new Set([
  "openai/gpt-4o-mini-tts-2025-12-15",
  "openai/tts-1",
  "openai/tts-1-hd",
  "tts-1",
  "tts-1-hd",
]);

export function resolveTtsModel(provider: TtsProviderId, model?: string): string | undefined {
  if (provider === "edge-tts" || provider === "gemini") return undefined;

  if (provider === "openai") {
    if (model && OPENAI_TTS_MODELS.some((item) => item.id === model)) return model;
    if (model?.startsWith("openai/")) return "tts-1";
    return model ?? "tts-1";
  }

  if (provider === "openrouter") {
    if (!model?.trim()) return undefined;
    if (LEGACY_OPENROUTER_MODEL_IDS.has(model)) return undefined;
    return model;
  }

  return model;
}

export {
  filterChineseVoices,
  filterChineseTtsModelsWithVoices,
  formatVoiceLabel,
  voiceIdSupportsChinese,
} from "./chinese-tts.js";
