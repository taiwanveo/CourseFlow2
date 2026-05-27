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

type OpenRouterImagePart = {
  image_url?: { url?: string };
  imageUrl?: { url?: string };
};

async function generateStepImageOpenRouterOnce(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<Uint8Array> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://courseflow.local",
      "X-Title": "CourseFlow",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image"],
      image_config: { aspect_ratio: "16:9" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `OpenRouter 生圖失敗 (${res.status})：${detail.slice(0, 400)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        images?: OpenRouterImagePart[];
        content?: unknown;
      };
    }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const message = data.choices?.[0]?.message;
  const fromImages =
    message?.images?.[0]?.image_url?.url ?? message?.images?.[0]?.imageUrl?.url;
  if (fromImages) {
    const parsed = parseDataUrl(fromImages);
    if (parsed) return parsed;
    if (fromImages.startsWith("http")) {
      const imageRes = await fetch(fromImages);
      if (!imageRes.ok) throw new Error("下載 OpenRouter 生成圖片失敗");
      return new Uint8Array(await imageRes.arrayBuffer());
    }
  }

  const content = message?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part !== "object" || part == null) continue;
      const url =
        (part as OpenRouterImagePart).image_url?.url ??
        (part as OpenRouterImagePart).imageUrl?.url;
      if (!url) continue;
      const parsed = parseDataUrl(url);
      if (parsed) return parsed;
    }
  }

  throw new Error("OpenRouter 生圖 API 未回傳圖片");
}

async function generateStepImageOpenRouter(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<Uint8Array> {
  const attempts = [prompt, `${prompt}\n\nOutput one clear 16:9 illustration image only.`];
  let lastError: Error | undefined;
  for (const body of attempts) {
    try {
      return await generateStepImageOpenRouterOnce(apiKey, body, model);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("OpenRouter 生圖 API 未回傳圖片");
}

/** 依步驟內容生成 16:9 教學簡報配圖 */
export async function generateStepImage(
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
    return generateStepImageOpenRouter(creds.apiKey, prompt, model);
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

function stylePromptUsesChinese(styleFragment: string): boolean {
  return /[\u4e00-\u9fff]/.test(styleFragment);
}

export function buildStepImagePrompt(params: {
  courseTopic: string;
  screenContent: string;
  script: string;
  /** BananaX 中文風格規範或英文風格片段 */
  styleFragment?: string;
}): string {
  const topic = params.courseTopic.trim() || "Educational course";
  const screen = params.screenContent.trim();
  const script = params.script.trim().slice(0, 1200);
  const styleFragment = params.styleFragment?.trim();

  if (styleFragment && stylePromptUsesChinese(styleFragment)) {
    const styleBlock = styleFragment.slice(0, 12000);
    return [
      "請生成一張 16:9 比例的教學投影片配圖（大學線上課程用）。",
      "用途：教學影片的輔助視覺背景，不是塞滿文字的資訊圖海報。",
      "硬性規則：畫面中不可出現可辨識的文字、字母、數字、浮水印、商標或 UI 框架；簡報標題與字幕由系統另行疊加。",
      "構圖：單一清晰主題、光線柔和、留白充足，適合與投影片排版並存。",
      "【以下為 BananaX 視覺風格規範 — 僅套用配色、字體氣質、材質、構圖與氛圍，勿在圖中渲染可讀文字】",
      styleBlock,
      `課程主題：${topic}`,
      screen ? `本步螢幕重點（勿畫成文字）：${screen}` : "",
      script ? `口播內容（作為意象與隱喻參考）：${script}` : "",
      "請依本步教學重點呈現一個有助理解的視覺意象。",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "Create a single 16:9 educational presentation illustration for a university-level online course slide.",
    "Purpose: supporting visual for a teaching video — NOT a poster with text.",
    "Strict rules: NO text, NO letters, NO numbers, NO watermark, NO logo, NO UI mockup frames.",
    "Composition: one clear focal subject, soft lighting, uncluttered, suitable behind or beside slide typography.",
    styleFragment
      ? `Visual style reference (apply color, texture, and mood only — do not add readable text): ${styleFragment}`
      : "Style: clean modern flat or semi-flat design, professional.",
    `Course subject / module theme: ${topic}`,
    screen ? `What appears on screen (key ideas only, do not render as text): ${screen}` : "",
    script
      ? `What the instructor explains in voiceover (use for context and metaphors): ${script}`
      : "",
    "Depict one clear concept that helps learners understand this specific step.",
  ]
    .filter(Boolean)
    .join("\n");
}
