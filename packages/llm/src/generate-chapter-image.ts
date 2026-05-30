import OpenAI from "openai";
import type { LlmCredentials, LlmProviderId } from "./types.js";

/** 支援圖像生成的提供者（依 API Key 設定） */
export const IMAGE_GENERATION_PROVIDERS: LlmProviderId[] = ["openai", "openrouter"];

const IMAGE_MODELS: Partial<Record<LlmProviderId, string>> = {
  openai: "dall-e-3",
  openrouter: "google/gemini-2.5-flash-image",
};

function createImageClient(creds: LlmCredentials): OpenAI {
  if (creds.provider === "openrouter") {
    return new OpenAI({
      apiKey: creds.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return new OpenAI({ apiKey: creds.apiKey });
}

function decodeBase64Image(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:[^;]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[1]) return null;
  return decodeBase64Image(match[1]);
}

async function generateChapterImageOpenRouter(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<Uint8Array> {
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://courseflow.app",
      "X-Title": "CourseFlow",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      image_config: { aspect_ratio: "16:9" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (errText.includes("<!DOCTYPE") || errText.includes("<html")) {
      throw new Error("OpenRouter 生圖請求失敗（收到 HTML 回應，請確認模型支援圖像生成）");
    }
    let errMsg = `OpenRouter 生圖失敗（${res.status}）`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `：${errJson?.error?.message ?? errText.slice(0, 200)}`;
    } catch {
      errMsg += `：${errText.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        images?: Array<{ image_url?: { url?: string } }>;
        content?: string;
      };
    }>;
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imageUrl) {
    const parsed = parseDataUrl(imageUrl);
    if (parsed) return parsed;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("下載 OpenRouter 生成圖片失敗");
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  const item = data?.data?.[0];
  if (item?.b64_json) return decodeBase64Image(item.b64_json);
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error("下載 OpenRouter 生成圖片失敗");
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  throw new Error("OpenRouter 生圖 API 未回傳圖片（請確認模型支援圖像生成，並在「設定」頁確認 image model 設定）");
}

function styleUsesChinese(styleFragment: string): boolean {
  return /[\u4e00-\u9fff]/.test(styleFragment);
}

/**
 * 為整個章節建構生圖提示詞。
 * 接受章節標題 + 所有步驟摘要，生成一張代表整章主旨的 16:9 圖片。
 */
export function buildChapterImagePrompt(params: {
  courseTopic: string;
  chapterTitle: string;
  allScreenContents: string[];
  allNarrations: string[];
  styleFragment?: string;
}): string {
  const topic = params.courseTopic.trim() || "Educational course";
  const chapterTitle = params.chapterTitle.trim();
  const screens = params.allScreenContents
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(" / ");
  const narrations = params.allNarrations
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((n) => n.slice(0, 80))
    .join(" / ");
  const styleFragment = params.styleFragment?.trim();

  if (styleFragment && styleUsesChinese(styleFragment)) {
    return [
      "你是「簡報視覺導演、教學插圖設計師」。",
      "任務：生成一張代表整個章節核心主旨的 16:9 教學配圖。",
      "這張圖會在整個章節播放期間固定顯示為背景，需要能涵蓋章節整體概念，而非單一步驟細節。",
      "構圖原則：單一強力視覺焦點、留白充足（文字會疊加其上）、視覺層次清楚，避免過於繁雜。",
      "文字規則：是否需要在圖片中放文字可由模型判斷；若有助理解可放，預設使用台灣繁體中文。",
      "禁止：浮水印、商標、品牌 logo、介面框。",
      "避免：過度科技感、過度抽象、過度雜亂、俗套商務素材風。",
      "【以下為 BananaX 視覺風格規範 — 套用配色、字體氣質、材質、構圖與氛圍】",
      styleFragment.slice(0, 12000),
      `課程主題：${topic}`,
      `章節標題：${chapterTitle}`,
      screens ? `本章重點（語意理解用，不可直接畫字）：${screens}` : "",
      narrations ? `口播重點（語意理解用，不可直接畫字）：${narrations}` : "",
      "輸出內容只要圖片，不要任何文字說明。",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "You are a presentation visual director and instructional design illustrator.",
    "Task: generate ONE 16:9 chapter-cover illustration that represents the overall theme of this entire chapter.",
    "This image will be shown as a fixed background throughout the chapter, so it must represent the chapter as a whole, not a single step.",
    "Composition: one strong focal subject, generous negative space (slide text will overlay this image), clear visual hierarchy.",
    "Text policy: text is allowed if it improves clarity; default to Traditional Chinese (Taiwan standard).",
    "NO watermark, NO logo, NO branded marks, NO UI frames.",
    "Avoid: over-sci-fi look, overly abstract noise, clutter, generic stock-business vibe.",
    styleFragment
      ? `Style reference (apply palette/material/mood only): ${styleFragment.slice(0, 4000)}`
      : "Style: clean modern educational illustration, professional and concept-driven.",
    `Course subject: ${topic}`,
    `Chapter title: ${chapterTitle}`,
    screens ? `Chapter key concepts (semantic only, do not render as text): ${screens}` : "",
    narrations ? `Voiceover themes (semantic only, do not render as text): ${narrations}` : "",
    "Render one final still image only, no text explanation.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 依章節整體內容生成 16:9 教學章節配圖 */
export async function generateChapterImage(
  creds: LlmCredentials,
  prompt: string,
): Promise<Uint8Array> {
  if (
    !IMAGE_GENERATION_PROVIDERS.includes(
      creds.provider as (typeof IMAGE_GENERATION_PROVIDERS)[number],
    )
  ) {
    throw new Error(
      `AI 生圖目前支援 OpenAI 或 OpenRouter API Key，請至設定頁填寫（目前：${creds.provider}）`,
    );
  }

  const model =
    creds.model ?? IMAGE_MODELS[creds.provider] ?? "dall-e-3";

  if (creds.provider === "openrouter") {
    return generateChapterImageOpenRouter(creds.apiKey, prompt, model);
  }

  const client = createImageClient(creds);
  const res = await client.images.generate({
    model,
    prompt,
    size: "1792x1024",
    n: 1,
    quality: "standard",
  });

  const item = res.data?.[0];
  if (item?.b64_json) {
    return decodeBase64Image(item.b64_json);
  }

  const url = item?.url;
  if (!url) throw new Error("生圖 API 未回傳圖片");

  const imageRes = await fetch(url);
  if (!imageRes.ok) throw new Error("下載生成圖片失敗");
  return new Uint8Array(await imageRes.arrayBuffer());
}
