import type { TtsModel, TtsProviderId, TtsVoice } from "./types.js";

/** OpenAI / OpenRouter 共用：多語系語音（支援中文） */
const OPENAI_MULTILINGUAL_VOICE_IDS = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
]);

/** Gemini 預設語音（支援中文） */
const GEMINI_MULTILINGUAL_VOICE_IDS = new Set([
  "kore",
  "puck",
  "charon",
  "fenrir",
  "aoede",
  "zephyr",
  "leda",
  "orus",
]);

const OPENAI_VOICE_ZH: Record<string, { name: string; gender: TtsVoice["gender"] }> = {
  alloy: { name: "悅音", gender: "neutral" },
  ash: { name: "灰岩", gender: "male" },
  ballad: { name: "敘事", gender: "male" },
  coral: { name: "珊瑚", gender: "female" },
  echo: { name: "回音", gender: "male" },
  fable: { name: "寓言", gender: "male" },
  nova: { name: "新星", gender: "female" },
  onyx: { name: "瑪瑙", gender: "male" },
  sage: { name: "智者", gender: "female" },
  shimmer: { name: "微光", gender: "female" },
  verse: { name: "詩韻", gender: "male" },
};

const GEMINI_VOICE_ZH: Record<string, { name: string; gender: TtsVoice["gender"] }> = {
  kore: { name: "清妍", gender: "female" },
  puck: { name: "明朗", gender: "male" },
  charon: { name: "沉穩", gender: "male" },
  fenrir: { name: "蒼狼", gender: "male" },
  aoede: { name: "悠揚", gender: "female" },
  zephyr: { name: "清風", gender: "neutral" },
  leda: { name: "柔光", gender: "female" },
  orus: { name: "渾厚", gender: "male" },
};

/** Microsoft Neural 常見中文語音 ID → 顯示名稱 */
const MS_NEURAL_VOICE_ZH: Record<string, { name: string; gender: TtsVoice["gender"] }> = {
  "zh-tw-hsiaochenneural": { name: "曉臻", gender: "female" },
  "zh-tw-hsiaoyuneural": { name: "曉雨", gender: "female" },
  "zh-tw-hsiaoyuneural2": { name: "曉雨", gender: "female" },
  "zh-tw-yunjheneural": { name: "雲哲", gender: "male" },
  "zh-tw-yunxiaoneural": { name: "雲霄", gender: "male" },
  "zh-cn-xiaoxiaoneural": { name: "晓晓", gender: "female" },
  "zh-cn-xiaoyineural": { name: "晓伊", gender: "female" },
  "zh-cn-yunxineural": { name: "云希", gender: "male" },
  "zh-cn-yunjianneural": { name: "云健", gender: "male" },
  "zh-cn-yunyangneural": { name: "云扬", gender: "male" },
  "zh-cn-yunfengneural": { name: "云枫", gender: "male" },
  "zh-hk-hiumaanneural": { name: "曉曼", gender: "female" },
  "zh-hk-wanlungneural": { name: "雲龍", gender: "male" },
};

const NON_CHINESE_LOCALE_RE =
  /^(en|fr|de|es|it|ja|ko|pt|ru|ar|hi|id|nl|pl|sv|tr|vi|th|uk|cs|da|fi|el|he|hu|nb|ro|sk)[-_]/i;

function voiceIdBase(voiceId: string): string {
  return voiceId.split(":")[0]!.trim().toLowerCase();
}

/** 判斷語音 ID 是否支援中文朗讀 */
export function voiceIdSupportsChinese(voiceId: string): boolean {
  const base = voiceIdBase(voiceId);
  if (!base) return false;

  if (OPENAI_MULTILINGUAL_VOICE_IDS.has(base)) return true;
  if (GEMINI_MULTILINGUAL_VOICE_IDS.has(base)) return true;

  if (/^zh[-_](cn|tw|hk|hans|hant)\b/i.test(voiceId)) return true;
  if (/^cmn[-_]/i.test(voiceId)) return true;
  if (/^yue[-_]/i.test(voiceId)) return true;

  if (NON_CHINESE_LOCALE_RE.test(voiceId)) return false;

  if (/chinese|mandarin|cantonese|xiaoxiao|yunxi|hsiao|yunjhe/i.test(voiceId)) return true;

  return false;
}

function inferGenderFromNeuralId(voiceId: string): TtsVoice["gender"] | undefined {
  const segment = voiceId.match(/[-_](\w+)neural/i)?.[1]?.toLowerCase() ?? "";
  if (/^(yun|han|bo|feng|jian|long|lung|xi|yang|zhi)/.test(segment)) return "male";
  if (/^(xiao|hsiao|yi|man|xia|chen|yue|hui)/.test(segment)) return "female";
  return undefined;
}

/** 將語音 ID 轉為使用者友善的中文顯示名稱 */
export function friendlyChineseVoiceMeta(
  voiceId: string,
  provider: TtsProviderId,
): { name: string; gender?: TtsVoice["gender"]; language: string } {
  const base = voiceIdBase(voiceId);

  const openaiMeta = OPENAI_VOICE_ZH[base];
  if (openaiMeta) {
    return { ...openaiMeta, language: "multi" };
  }

  const geminiMeta = GEMINI_VOICE_ZH[base];
  if (geminiMeta) {
    return { ...geminiMeta, language: "multi" };
  }

  const msKey = base.replace(/:.*$/, "");
  const msMeta = MS_NEURAL_VOICE_ZH[msKey];
  if (msMeta) {
    const langMatch = voiceId.match(/^zh[-_](TW|CN|HK)/i);
    const language = langMatch
      ? `zh-${langMatch[1]!.toUpperCase()}`
      : provider === "edge-tts"
        ? "zh-TW"
        : "zh";
    return { ...msMeta, language };
  }

  const zhLocale = voiceId.match(/^zh[-_](CN|TW|HK)/i);
  if (zhLocale) {
    const gender = inferGenderFromNeuralId(voiceId);
    const rawName = voiceId.match(/[-_](\w+?)(?:Neural|:|$)/i)?.[1] ?? voiceId;
    return {
      name: rawName.replace(/([a-z])([A-Z])/g, "$1 $2"),
      gender,
      language: `zh-${zhLocale[1]!.toUpperCase()}`,
    };
  }

  return {
    name: voiceId.includes(":") ? voiceId.split(":")[0]! : voiceId,
    language: "multi",
  };
}

/** 套用中文友善名稱，並標記語系 */
export function enrichChineseVoice(voice: TtsVoice): TtsVoice {
  if (!voiceIdSupportsChinese(voice.id)) return voice;

  const meta = friendlyChineseVoiceMeta(voice.id, voice.provider);
  const name = meta.name.replace(/[（(](男聲|女聲|中性)[）)]/g, "").trim();

  return {
    ...voice,
    name,
    gender: voice.gender ?? meta.gender,
    language: meta.language || voice.language,
  };
}

/** 只保留支援中文的語音 */
export function filterChineseVoices(voices: TtsVoice[]): TtsVoice[] {
  const seen = new Set<string>();
  const result: TtsVoice[] = [];
  for (const voice of voices) {
    if (!voiceIdSupportsChinese(voice.id)) continue;
    const key = `${voice.provider}:${voice.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(enrichChineseVoice(voice));
  }
  return result;
}

/** 若模型未附語音清單，以 getTtsVoicesForModel 補齊後再篩選 */
export function filterChineseTtsModelsWithVoices(
  models: TtsModel[],
  resolveVoices: (modelId: string, provider: TtsProviderId) => TtsVoice[],
): TtsModel[] {
  const filtered: TtsModel[] = [];
  for (const model of models) {
    const rawVoices =
      model.voices && model.voices.length > 0
        ? model.voices
        : resolveVoices(model.id, model.provider);
    const voices = filterChineseVoices(rawVoices);
    if (voices.length > 0) {
      filtered.push({ ...model, voices });
    }
  }
  return filtered;
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

  if (!genderLabel) return voice.name;
  if (/[（(](男聲|女聲|中性)[）)]/.test(voice.name)) return voice.name;
  return `${voice.name}（${genderLabel}）`;
}
