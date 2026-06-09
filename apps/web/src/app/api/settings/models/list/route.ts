import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/crypto";

export const runtime = "nodejs";

export interface ModelEntry {
  id: string;
  name: string;
}
export interface ModelRecommendation {
  id: string;
  name: string;
  reason: string;
}
export interface ModelsResult {
  text: ModelEntry[];
  image: ModelEntry[];
  recommendations?: {
    text: ModelRecommendation[];
    image: ModelRecommendation[];
  };
}

/** 設定頁下拉選單：依顯示名稱字母排序，同名時再以 id 排序。 */
function sortModelEntries(entries: ModelEntry[]): ModelEntry[] {
  return [...entries].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    return byName !== 0
      ? byName
      : a.id.localeCompare(b.id, "en", { sensitivity: "base" });
  });
}

function sortModelsResult(result: Omit<ModelsResult, "recommendations">): ModelsResult {
  return {
    text: sortModelEntries(result.text),
    image: sortModelEntries(result.image),
  };
}

// ── 靜態推薦規則 ────────────────────────────────────────────────────────────
// 優先序依「能力 × 速度 × 性價比」排列，符合教學影片生成場景
const TEXT_RECOMMENDATIONS: Record<string, { reason: string; priority: number }> = {
  // OpenAI
  "gpt-4o-mini":          { reason: "速度快、性價比最高，大綱 / 口播稿生成首選", priority: 1 },
  "gpt-4o":               { reason: "能力最強，複雜課程架構或多語言內容推薦", priority: 2 },
  "gpt-4.1-mini":         { reason: "4o-mini 繼任者，速度與品質兼具", priority: 1 },
  "gpt-4.1":              { reason: "旗艦級推理，處理專業技術內容表現優異", priority: 2 },
  // Gemini
  "gemini-2.0-flash":     { reason: "Google 最快模型，速度極佳，適合大量內容生成", priority: 1 },
  "gemini-2.5-flash":     { reason: "Flash 升級版，中文理解更佳", priority: 1 },
  "gemini-2.5-pro":       { reason: "Google 最強模型，處理長文與結構化大綱表現突出", priority: 2 },
  // OpenRouter 熱門
  "google/gemini-2.0-flash-001":     { reason: "速度極快，性價比高，首選文字生成", priority: 1 },
  "google/gemini-2.5-flash-preview": { reason: "Flash 升級版，中文與長文理解更強", priority: 1 },
  "openai/gpt-4o-mini":              { reason: "速度快、成本低，大綱 / 口播稿生成首選", priority: 1 },
  "openai/gpt-4o":                   { reason: "高品質輸出，複雜結構或多語言課程推薦", priority: 2 },
  "anthropic/claude-3.5-haiku":      { reason: "Claude 最快版本，擅長結構化寫作與長文摘要", priority: 1 },
  "anthropic/claude-sonnet-4-5":     { reason: "Claude 旗艦，指令遵循強，適合精細課程設計", priority: 2 },
  "anthropic/claude-3.7-sonnet":     { reason: "指令遵循強，適合精細課程設計", priority: 2 },
  "qwen/qwen3-30b-a3b":              { reason: "混合推理模型，中文內容理解優異，速度快", priority: 1 },
  "meta-llama/llama-4-maverick":     { reason: "免費額度多，適合試用評估", priority: 3 },
};

const IMAGE_RECOMMENDATIONS: Record<string, { reason: string; priority: number }> = {
  // OpenAI
  "dall-e-3":      { reason: "最高品質，精確理解中文 prompt，教學配圖首選", priority: 1 },
  "gpt-image-1":   { reason: "最新世代，提示詞理解最強，細節最豐富", priority: 1 },
  "dall-e-2":      { reason: "成本最低，速度快，簡單示意圖適用", priority: 3 },
  // OpenRouter
  "openai/dall-e-3":                         { reason: "精確理解中文 prompt，教學配圖首選", priority: 1 },
  "openai/gpt-image-1":                      { reason: "最新世代，提示詞理解最強", priority: 1 },
  "black-forest-labs/flux-1.1-pro":          { reason: "FLUX 最佳版，寫實風格表現優異", priority: 2 },
  "black-forest-labs/flux-1-schnell":        { reason: "FLUX 快速版，速度極快，成本低", priority: 2 },
  "stabilityai/stable-diffusion-3.5-large":  { reason: "SD 3.5 旗艦，風格多樣，細節豐富", priority: 2 },
  "google/imagen-3":                         { reason: "Google 出品，相片寫實風格最佳", priority: 2 },
};

function buildRecommendations(result: Omit<ModelsResult, "recommendations">): ModelsResult["recommendations"] {
  const textIds = new Set(result.text.map((m) => m.id));
  const imageIds = new Set(result.image.map((m) => m.id));

  const textRecs = Object.entries(TEXT_RECOMMENDATIONS)
    .filter(([id]) => textIds.has(id))
    .sort((a, b) => a[1].priority - b[1].priority)
    .slice(0, 3)
    .map(([id, { reason }]) => ({
      id,
      name: result.text.find((m) => m.id === id)?.name ?? id,
      reason,
    }));

  const imageRecs = Object.entries(IMAGE_RECOMMENDATIONS)
    .filter(([id]) => imageIds.has(id))
    .sort((a, b) => a[1].priority - b[1].priority)
    .slice(0, 3)
    .map(([id, { reason }]) => ({
      id,
      name: result.image.find((m) => m.id === id)?.name ?? id,
      reason,
    }));

  return { text: textRecs, image: imageRecs };
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelsResult> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = (await res.json()) as { data: { id: string }[] };
  const IMAGE_IDS = new Set(["dall-e-3", "dall-e-2", "gpt-image-1"]);
  const SKIP = /whisper|tts|embedding|audio|realtime|instruct|ft:/i;
  const all = (data.data ?? []).sort((a, b) => a.id.localeCompare(b.id));
  return {
    text: all
      .filter((m) => !SKIP.test(m.id) && !IMAGE_IDS.has(m.id))
      .map((m) => ({ id: m.id, name: m.id })),
    image: all
      .filter((m) => IMAGE_IDS.has(m.id))
      .map((m) => ({ id: m.id, name: m.id })),
  };
}

async function fetchOpenRouterModels(apiKey: string): Promise<ModelsResult> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
  const data = (await res.json()) as {
    data: {
      id: string;
      name: string;
      architecture?: { modality?: string };
    }[];
  };
  const all = data.data ?? [];
  // 圖片生成模型：modality 輸出端（-> 右側）含 "image"
  // text->image ✓  text->text,image ✓  text+image->text（視覺理解）✗
  const imageModels = all.filter((m) => {
    const mod = m.architecture?.modality ?? "";
    const outputPart = mod.split("->")[1] ?? "";
    return outputPart.toLowerCase().includes("image");
  });
  const imageIds = new Set(imageModels.map((m) => m.id));
  return {
    text: all
      .filter((m) => {
        const mod = m.architecture?.modality ?? "";
        return mod.includes("text") && !imageIds.has(m.id);
      })
      .map((m) => ({ id: m.id, name: m.name || m.id })),
    image: imageModels.map((m) => ({ id: m.id, name: m.name || m.id })),
  };
}

async function fetchGeminiModels(apiKey: string): Promise<ModelsResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = (await res.json()) as {
    models: {
      name: string;
      displayName: string;
      supportedGenerationMethods: string[];
    }[];
  };
  return {
    text: (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name.replace("models/", ""),
      })),
    image: [], // Gemini 圖片生成不走 OpenAI-compatible 端點
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider)
    return NextResponse.json({ error: "缺少 provider" }, { status: 400 });

  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  if (!keyRow?.encrypted_key)
    return NextResponse.json({ error: "找不到 API Key" }, { status: 404 });

  let apiKey: string;
  try {
    apiKey = decryptApiKey(keyRow.encrypted_key);
  } catch {
    return NextResponse.json(
      {
        error: "這組 API Key 無法解密，可能是加密金鑰已變更。請重新儲存此 provider 的 API Key。",
      },
      { status: 409 },
    );
  }

  try {
    const result =
      provider === "openai"
        ? await fetchOpenAIModels(apiKey)
        : provider === "openrouter"
          ? await fetchOpenRouterModels(apiKey)
          : provider === "gemini"
            ? await fetchGeminiModels(apiKey)
            : null;

    if (!result)
      return NextResponse.json({ error: "不支援的 provider" }, { status: 400 });

    const sorted = sortModelsResult(result);
    return NextResponse.json({
      ...sorted,
      recommendations: buildRecommendations(sorted),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: `無法取得模型清單：${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
