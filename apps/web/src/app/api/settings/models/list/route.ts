import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/crypto";

export const runtime = "nodejs";

export interface ModelEntry {
  id: string;
  name: string;
}
export interface ModelsResult {
  text: ModelEntry[];
  image: ModelEntry[];
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
  return {
    text: all
      .filter((m) => {
        const mod = m.architecture?.modality ?? "";
        return mod.includes("text") && !mod.includes("->image");
      })
      .map((m) => ({ id: m.id, name: m.name || m.id })),
    image: all
      .filter((m) => (m.architecture?.modality ?? "").includes("->image"))
      .map((m) => ({ id: m.id, name: m.name || m.id })),
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

  const apiKey = decryptApiKey(keyRow.encrypted_key);
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

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: `無法取得模型清單：${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
