import OpenAI from "openai";
import { filterChineseVoices } from "./chinese-tts.js";
import type { TtsCredentials, TtsProvider, TtsVoice, TtsSynthesizeOptions } from "./types.js";
import { OPENAI_TTS_VOICES, resolveTtsModel } from "./types.js";
import {
  fetchOpenRouterTtsCatalog,
  synthesizeOpenRouterSpeech,
} from "./openrouter-tts.js";

export const openAiTtsProvider: TtsProvider = {
  id: "openai",
  requiresApiKey: true,

  async listVoices(credentials?: TtsCredentials): Promise<TtsVoice[]> {
    if (!credentials?.apiKey) return [];
    return filterChineseVoices(OPENAI_TTS_VOICES);
  },

  async synthesize(
    text: string,
    voiceId: string,
    credentials?: TtsCredentials,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer> {
    if (!credentials?.apiKey) throw new Error("缺少 OpenAI API Key");
    const client = new OpenAI({ apiKey: credentials.apiKey });
    const res = await client.audio.speech.create({
      model: resolveTtsModel("openai", options?.model) ?? "tts-1",
      voice: voiceId as "alloy",
      input: text,
      response_format: "mp3",
    });
    return Buffer.from(await res.arrayBuffer());
  },
};

export const openRouterTtsProvider: TtsProvider = {
  id: "openrouter",
  requiresApiKey: true,

  async listVoices(credentials?: TtsCredentials): Promise<TtsVoice[]> {
    if (!credentials?.apiKey) return [];
    const models = await fetchOpenRouterTtsCatalog(credentials.apiKey);
    const seen = new Set<string>();
    const voices: TtsVoice[] = [];
    for (const model of models) {
      for (const voice of model.voices ?? []) {
        if (seen.has(voice.id)) continue;
        seen.add(voice.id);
        voices.push(voice);
      }
    }
    return filterChineseVoices(voices);
  },

  async synthesize(
    text: string,
    voiceId: string,
    credentials?: TtsCredentials,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer> {
    if (!credentials?.apiKey) throw new Error("缺少 OpenRouter API Key");
    const model = resolveTtsModel("openrouter", options?.model);
    if (!model) {
      throw new Error("請選擇 OpenRouter TTS 模型（需支援 speech 輸出）");
    }
    return synthesizeOpenRouterSpeech(credentials.apiKey, text, model, voiceId);
  },
};

export const geminiTtsProvider: TtsProvider = {
  id: "gemini",
  requiresApiKey: true,

  async listVoices(credentials?: TtsCredentials): Promise<TtsVoice[]> {
    if (!credentials?.apiKey) return [];
    return filterChineseVoices([
      { id: "Kore", name: "Kore", language: "multi", gender: "female", provider: "gemini" },
      { id: "Puck", name: "Puck", language: "multi", gender: "male", provider: "gemini" },
      { id: "Charon", name: "Charon", language: "multi", gender: "male", provider: "gemini" },
    ]);
  },

  async synthesize(
    text: string,
    voiceId: string,
    credentials?: TtsCredentials,
  ): Promise<Buffer> {
    if (!credentials?.apiKey) throw new Error("缺少 Gemini API Key");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${credentials.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } },
          },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini TTS 失敗: ${err}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
    };
    const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error("Gemini TTS 無音訊資料");
    return Buffer.from(b64, "base64");
  },
};
