import {
  enrichChineseVoice,
  filterChineseTtsModelsWithVoices,
  filterChineseVoices,
  voiceIdSupportsChinese,
} from "./chinese-tts.js";
import type { OpenRouterTtsRoute, TtsModel, TtsVoice } from "./types.js";
import { getTtsVoicesForModel } from "./types.js";

const OPENROUTER_MODELS_BASE = "https://openrouter.ai/api/v1/models";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

const MUSIC_MODEL_PATTERN = /lyria|musicgen|music-gen|bark|audiogen|audiocraft|musiclm/i;

export interface OpenRouterSpeechModelRow {
  id: string;
  name: string;
  supported_voices?: string[];
  architecture?: {
    output_modalities?: string[];
    modality?: string;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterSpeechModelRow[];
}

/** 最近一次 catalog 拉取的模型列（供合成時選路由） */
let cachedOpenRouterTtsRows: OpenRouterSpeechModelRow[] = [];

const OPENROUTER_HEADERS = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  "HTTP-Referer": "https://courseflow.app",
  "X-Title": "CourseFlow",
});

function outputModalities(row: OpenRouterSpeechModelRow): string[] {
  return row.architecture?.output_modalities ?? [];
}

function isOpenRouterTtsModel(row: OpenRouterSpeechModelRow): boolean {
  if (MUSIC_MODEL_PATTERN.test(row.id)) return false;
  const modalities = outputModalities(row);
  if (modalities.includes("speech") || modalities.includes("audio")) return true;
  return row.architecture?.modality === "text->speech";
}

/** speech 模型走 /audio/speech；audio 模型走 chat completions + modalities */
export function openRouterTtsRouteForRow(row: OpenRouterSpeechModelRow): OpenRouterTtsRoute {
  const modalities = outputModalities(row);
  if (modalities.includes("speech")) return "speech-api";
  if (modalities.includes("audio")) return "chat-audio";
  if (row.architecture?.modality === "text->speech") return "speech-api";
  if (/tts|voxtral|gemini.*tt/i.test(row.id)) return "speech-api";
  if (/gpt-4o.*audio|audio.*preview|o1.*audio/i.test(row.id)) return "chat-audio";
  return "speech-api";
}

export function openRouterTtsRouteForModel(modelId: string): OpenRouterTtsRoute {
  const row = cachedOpenRouterTtsRows.find((item) => item.id === modelId);
  if (row) return openRouterTtsRouteForRow(row);
  if (/gpt-4o.*audio|audio.*preview|o1.*audio/i.test(modelId)) return "chat-audio";
  return "speech-api";
}

export function openRouterVoicesForModel(
  modelId: string,
  rows: OpenRouterSpeechModelRow[],
): TtsVoice[] {
  const row = rows.find((item) => item.id === modelId);
  const voices = (row?.supported_voices ?? [])
    .filter((id) => voiceIdSupportsChinese(id))
    .map((id) => enrichChineseVoice({ id, name: id, language: "multi", provider: "openrouter" }));
  if (voices.length > 0) return voices;
  return filterChineseVoices(getTtsVoicesForModel(modelId, "openrouter"));
}

export function openRouterRowsToTtsModels(rows: OpenRouterSpeechModelRow[]): TtsModel[] {
  const models = rows.map((row) => ({
    id: row.id,
    name: row.name,
    provider: "openrouter" as const,
    voices: openRouterVoicesForModel(row.id, rows),
    openRouterRoute: openRouterTtsRouteForRow(row),
  }));
  return filterChineseTtsModelsWithVoices(models, (modelId) =>
    filterChineseVoices(getTtsVoicesForModel(modelId, "openrouter")),
  );
}

async function fetchOpenRouterModelsByModality(
  apiKey: string,
  modality: "speech" | "audio",
): Promise<OpenRouterSpeechModelRow[]> {
  const res = await fetch(`${OPENROUTER_MODELS_BASE}?output_modalities=${modality}`, {
    headers: OPENROUTER_HEADERS(apiKey),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter 模型清單失敗（${res.status}）${errText ? `：${errText.slice(0, 200)}` : ""}`,
    );
  }
  const payload = (await res.json()) as OpenRouterModelsResponse;
  return (payload.data ?? []).filter(isOpenRouterTtsModel);
}

export async function fetchOpenRouterSpeechModels(
  apiKey: string,
): Promise<OpenRouterSpeechModelRow[]> {
  const [speechRows, audioRows] = await Promise.all([
    fetchOpenRouterModelsByModality(apiKey, "speech").catch(() => [] as OpenRouterSpeechModelRow[]),
    fetchOpenRouterModelsByModality(apiKey, "audio").catch(() => [] as OpenRouterSpeechModelRow[]),
  ]);
  const byId = new Map<string, OpenRouterSpeechModelRow>();
  for (const row of [...speechRows, ...audioRows]) {
    byId.set(row.id, row);
  }
  const rows = [...byId.values()];
  cachedOpenRouterTtsRows = rows;
  return rows;
}

export async function fetchOpenRouterTtsCatalog(apiKey: string): Promise<TtsModel[]> {
  const rows = await fetchOpenRouterSpeechModels(apiKey);
  return openRouterRowsToTtsModels(rows);
}

function parseOpenRouterError(res: Response, errText: string, prefix: string): never {
  if (errText.includes("<!DOCTYPE") || errText.includes("<html")) {
    throw new Error(`${prefix}（收到 HTML 回應，請確認模型與 endpoint 是否正確）`);
  }
  let errMsg = `${prefix}（${res.status}）`;
  try {
    const errJson = JSON.parse(errText) as { error?: { message?: string } };
    errMsg += `：${errJson.error?.message ?? errText.slice(0, 200)}`;
  } catch {
    errMsg += `：${errText.slice(0, 200)}`;
  }
  throw new Error(errMsg);
}

async function synthesizeOpenRouterSpeechApi(
  apiKey: string,
  text: string,
  model: string,
  voiceId: string,
): Promise<Buffer> {
  const res = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: {
      ...OPENROUTER_HEADERS(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      voice: voiceId,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    parseOpenRouterError(res, errText, "OpenRouter TTS 失敗");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const errText = await res.text().catch(() => "");
    parseOpenRouterError(res, errText, "OpenRouter TTS 失敗");
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error("OpenRouter TTS 回應無音訊資料");
  }
  return Buffer.from(bytes);
}

function parseSseAudioChunks(body: ReadableStream<Uint8Array>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const audioChunks: string[] = [];

    const pump = (): void => {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            if (audioChunks.length === 0) {
              reject(new Error("OpenRouter TTS 回應無音訊資料"));
              return;
            }
            resolve(Buffer.from(audioChunks.join(""), "base64"));
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const chunk = JSON.parse(data) as {
                choices?: Array<{
                  delta?: { audio?: { data?: string } };
                  message?: { audio?: { data?: string } };
                }>;
              };
              const audioData =
                chunk.choices?.[0]?.delta?.audio?.data ??
                chunk.choices?.[0]?.message?.audio?.data;
              if (audioData) audioChunks.push(audioData);
            } catch {
              /* 略過無法解析的 SSE 行 */
            }
          }

          pump();
        })
        .catch(reject);
    };

    pump();
  });
}

async function synthesizeOpenRouterChatAudio(
  apiKey: string,
  text: string,
  model: string,
  voiceId: string,
): Promise<Buffer> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      ...OPENROUTER_HEADERS(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: text }],
      modalities: ["text", "audio"],
      audio: { voice: voiceId, format: "mp3" },
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    parseOpenRouterError(res, errText, "OpenRouter TTS 失敗");
  }

  if (!res.body) {
    throw new Error("OpenRouter TTS 回應缺少 body");
  }

  return parseSseAudioChunks(res.body);
}

export async function synthesizeOpenRouterSpeech(
  apiKey: string,
  text: string,
  model: string,
  voiceId: string,
  route?: OpenRouterTtsRoute,
): Promise<Buffer> {
  const resolvedRoute = route ?? openRouterTtsRouteForModel(model);
  if (resolvedRoute === "speech-api") {
    return synthesizeOpenRouterSpeechApi(apiKey, text, model, voiceId);
  }
  return synthesizeOpenRouterChatAudio(apiKey, text, model, voiceId);
}
