import OpenAI from "openai";
import type { LlmCredentials, LlmProviderId } from "./types.js";

/** 支援圖像生成的提供者（依 API Key 設定） */
export const IMAGE_GENERATION_PROVIDERS: LlmProviderId[] = ["openai", "openrouter"];

const IMAGE_MODELS: Partial<Record<LlmProviderId, string>> = {
  openai: "dall-e-3",
  // OpenRouter 預設使用 Gemini image model（DALL-E 3 需透過 OpenAI 直接呼叫）
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

async function generateStepImageOpenRouter(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<Uint8Array> {
  // OpenRouter 圖像生成透過 /v1/chat/completions + modalities 實現
  // 不支援 /v1/images/generations（該端點返回 404）
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

  // OpenRouter image generation 格式: choices[0].message.images[0].image_url.url（base64 data URL）
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imageUrl) {
    const parsed = parseDataUrl(imageUrl);
    if (parsed) return parsed;
    // URL 格式（非 data URL）
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("下載 OpenRouter 生成圖片失敗");
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  // 舊版相容：OpenAI images/generations 格式 (data[0].b64_json / url)
  const item = data?.data?.[0];
  if (item?.b64_json) return decodeBase64Image(item.b64_json);
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error("下載 OpenRouter 生成圖片失敗");
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  throw new Error("OpenRouter 生圖 API 未回傳圖片（請確認模型支援圖像生成，並在「設定」頁確認 image model 設定）");
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

/** Visual Director 傳入的生圖提示（避免 llm 依賴 visual-config） */
export type StepImageDirectorHints = {
  coreMessage?: string;
  sceneDescription?: string;
  imagePromptEn?: string;
  avoidElements?: string[];
  layoutIntegration?: string;
};

export function buildStepImagePrompt(params: {
  courseTopic: string;
  screenContent: string;
  script: string;
  /** BananaX 中文風格規範或英文風格片段 */
  styleFragment?: string;
  director?: StepImageDirectorHints;
  /** 章節內一致性錨點（角色/配色/構圖語彙） */
  chapterConsistencyHint?: string;
  /** 本步在章節中的敘事角色（開場/展開/收束） */
  stepContinuityRole?: string;
}): string {
  const topic = params.courseTopic.trim() || "Educational course";
  const screen = params.screenContent.trim();
  const script = params.script.trim().slice(0, 1200);
  const styleFragment = params.styleFragment?.trim();
  const director = params.director;
  const chapterConsistencyHint = params.chapterConsistencyHint?.trim();
  const stepContinuityRole = params.stepContinuityRole?.trim();

  if (director?.imagePromptEn?.trim()) {
    const avoid =
      director.avoidElements?.length ? director.avoidElements.join(", ") : "";
    return [
      director.imagePromptEn.trim(),
      director.sceneDescription?.trim()
        ? `Scene composition: ${director.sceneDescription.trim()}`
        : "",
      director.coreMessage?.trim()
        ? `Core teaching message (semantic only): ${director.coreMessage.trim()}`
        : "",
      director.layoutIntegration?.trim()
        ? `Layout hint: ${director.layoutIntegration.trim()}`
        : "",
      "Text policy: the model may decide whether text is needed in-image; text is allowed when it improves clarity.",
      "If text is used, default to Traditional Chinese (Taiwan standard).",
      "English is allowed when context naturally needs it; Japanese can be used sparingly when context truly needs it.",
      "Simplified Chinese is allowed only when explicitly required by source content or terms that must stay Simplified.",
      "Avoid unrelated foreign scripts (e.g., Cyrillic/French spellings) unless explicitly requested.",
      "NO watermark, NO logo, NO UI frames.",
      "Single 16:9 educational illustration, one clear focal subject, enough negative space.",
      chapterConsistencyHint
        ? `Chapter continuity constraints: ${chapterConsistencyHint.slice(0, 1200)}`
        : "",
      stepContinuityRole ? `Continuity role for this step: ${stepContinuityRole}` : "",
      avoid ? `Avoid: ${avoid}` : "",
      styleFragment
        ? `Style reference (palette/mood only): ${styleFragment.slice(0, 4000)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (styleFragment && stylePromptUsesChinese(styleFragment)) {
    const styleBlock = styleFragment.slice(0, 12000);
    return [
      "你是「簡報視覺導演、動態插圖設計師、教學設計顧問」。",
      "任務：先理解此頁真正要教會觀眾的概念，再生成一張最能補足理解的 16:9 教學配圖。",
      "用途：教學影片中的輔助插圖，不是文字海報，不是 UI 截圖，不是泛用裝飾圖。",
      "請優先做「內容感知」：讓圖像對應本頁的核心概念、關係、流程、風險、對比或情境，而非重複文字。",
      "文字規則：是否需要在圖片中放文字可由模型自行判斷；若有助理解可放文字，不是絕對禁止。",
      "若圖片需要文字，預設使用台灣繁體中文。",
      "英文可在語境自然需要時使用；日文可少量使用，但僅限情境確實需要。",
      "簡體中文僅能在來源內容或專有詞真的必須簡體時使用，不能濫用。",
      "除上述語境外，避免出現俄文、法文等無關外語字形。",
      "且不可有浮水印、商標、品牌 logo、介面框、圖表軸標。",
      "畫面原則：單一主視覺焦點、構圖清楚、留白足夠、視覺層次明確、可與投影片文字共存。",
      "若內容更適合流程/關係表達，請在單張圖中用物件關係與視覺路徑表現，不要塞文字。",
      chapterConsistencyHint
        ? `章節連續性約束（請保持同章視覺語彙與角色一致）：${chapterConsistencyHint.slice(0, 1200)}`
        : "",
      stepContinuityRole ? `本步敘事角色：${stepContinuityRole}` : "",
      "避免：過度科技感、過度抽象、過度雜亂、俗套商務素材風。",
      "【以下為 BananaX 視覺風格規範 — 僅套用配色、字體氣質、材質、構圖與氛圍，勿在圖中渲染可讀文字】",
      styleBlock,
      `課程主題：${topic}`,
      screen ? `螢幕文字重點（只可作語意理解，不可直接畫字）：${screen}` : "",
      script ? `口播稿重點（只可作語意理解，不可直接畫字）：${script}` : "",
      "請先判斷最適視覺類型（情境插圖/流程關係/風險警示/對比隱喻/系統互動），再輸出最終單張插圖。",
      "輸出內容只要圖片，不要任何文字說明。",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "You are a presentation visual director and instructional design illustrator.",
    "Task: infer the core teaching message of this slide, then generate ONE 16:9 supporting illustration that improves understanding.",
    "Do content-aware visual design: represent abstract ideas, relationships, process, risk, contrast, or scenario; do not paraphrase text.",
    "Purpose: supporting visual for a teaching video, NOT a text-heavy poster and NOT a UI screenshot.",
    "Text policy: the model may decide whether text is needed in-image; text is allowed when it improves clarity.",
    "If text is used, default to Traditional Chinese (Taiwan standard).",
    "English is allowed when context naturally needs it; Japanese can be used sparingly when context truly needs it.",
    "Simplified Chinese is allowed only when explicitly required by source content or terms that must stay Simplified.",
    "Avoid unrelated foreign scripts (e.g., Cyrillic/French spellings) unless explicitly requested.",
    "NO watermark, NO logo, NO branded marks, NO dashboard/UI frames.",
    "Composition: one clear focal subject, clean hierarchy, enough negative space, readable with overlaid slide typography.",
    chapterConsistencyHint
      ? `Chapter continuity constraints (keep same visual language and recurring subjects within chapter): ${chapterConsistencyHint.slice(0, 1200)}`
      : "",
    stepContinuityRole ? `Continuity role for this step: ${stepContinuityRole}` : "",
    "Avoid: over-sci-fi look, overly abstract noise, clutter, generic stock-business vibe.",
    styleFragment
      ? `Style reference (apply palette/material/mood only, never render readable text): ${styleFragment}`
      : "Style: clean modern educational illustration, professional and concept-driven.",
    `Course subject / module theme: ${topic}`,
    screen
      ? `On-screen key points (semantic guidance only, do not render as text): ${screen}`
      : "",
    script
      ? `Voiceover meaning (semantic guidance only, do not render as text): ${script}`
      : "",
    "First infer the best visual type, then render one final still image.",
    "Output image only.",
  ]
    .filter(Boolean)
    .join("\n");
}
