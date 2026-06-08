import type { TtsModel, TtsVoice } from "./types.js";

const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models?output_modalities=speech";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

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

function isSpeechModel(row: OpenRouterSpeechModelRow): boolean {
  if (MUSIC_MODEL_PATTERN.test(row.id)) return false;
  const modalities = row.architecture?.output_modalities ?? [];
  if (modalities.includes("speech")) return true;
  return row.architecture?.modality === "text->speech";
}

function voiceLabel(voiceId: string): string {
  const base = voiceId.includes(":") ? voiceId.split(":")[0]! : voiceId;
  return base.replace(/[_-]+/g, " ").trim();
}

export function openRouterVoicesForModel(
  modelId: string,
  rows: OpenRouterSpeechModelRow[],
): TtsVoice[] {
  const row = rows.find((item) => item.id === modelId);
  const voices = row?.supported_voices ?? [];
  return voices.map((id) => ({
    id,
    name: voiceLabel(id),
    language: "multi",
    provider: "openrouter",
  }));
}

export function openRouterRowsToTtsModels(rows: OpenRouterSpeechModelRow[]): TtsModel[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    provider: "openrouter" as const,
    voices: openRouterVoicesForModel(row.id, rows),
  }));
}

export async function fetchOpenRouterSpeechModels(
  apiKey: string,
): Promise<OpenRouterSpeechModelRow[]> {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://courseflow.app",
      "X-Title": "CourseFlow",
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter 模型清單失敗（${res.status}）${errText ? `：${errText.slice(0, 200)}` : ""}`,
    );
  }
  const payload = (await res.json()) as OpenRouterModelsResponse;
  return (payload.data ?? []).filter(isSpeechModel);
}

export async function fetchOpenRouterTtsCatalog(apiKey: string): Promise<TtsModel[]> {
  const rows = await fetchOpenRouterSpeechModels(apiKey);
  return openRouterRowsToTtsModels(rows);
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

export async function synthesizeOpenRouterSpeech(
  apiKey: string,
  text: string,
  model: string,
  voiceId: string,
): Promise<Buffer> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://courseflow.app",
      "X-Title": "CourseFlow",
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
    if (errText.includes("<!DOCTYPE") || errText.includes("<html")) {
      throw new Error("OpenRouter TTS 請求失敗（收到 HTML 回應，請確認模型支援語音輸出）");
    }
    let errMsg = `OpenRouter TTS 失敗（${res.status}）`;
    try {
      const errJson = JSON.parse(errText) as { error?: { message?: string } };
      errMsg += `：${errJson.error?.message ?? errText.slice(0, 200)}`;
    } catch {
      errMsg += `：${errText.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) {
    throw new Error("OpenRouter TTS 回應缺少 body");
  }

  return parseSseAudioChunks(res.body);
}
