import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/crypto";
import type { TtsModel } from "@courseflow/tts/types";
import { OPENROUTER_KNOWN_TTS_MODEL_IDS, OPENROUTER_TTS_MODELS } from "@courseflow/tts/types";

export const runtime = "nodejs";

// 已知的音樂生成 / 非 TTS 模型除外清單
const MUSIC_MODEL_PATTERN = /lyria|musicgen|music-gen|bark|audiogen|audiocraft|musiclm/i;
// 已知的 TTS 模型 ID 字串（有此即安全引入，不依賴 modality）
const TTS_ID_PATTERN = /tts|speech-synthesis|voice(-gen)?$/i;

async function fetchOpenRouterTtsModels(_apiKey: string): Promise<TtsModel[]> {
  // OpenRouter 模型目錄無 openai/tts-1；audio/speech 端點亦未對外提供。
  // gpt-audio 系列需走 chat completions，與現有 TTS 管線不相容。
  void OPENROUTER_KNOWN_TTS_MODEL_IDS;
  void OPENROUTER_TTS_MODELS;
  void MUSIC_MODEL_PATTERN;
  void TTS_ID_PATTERN;
  return [];
}

async function fetchOpenAITtsModels(apiKey: string): Promise<TtsModel[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = (await res.json()) as { data: { id: string }[] };
  // TTS 相關 ID 模式
  const TTS_RE = /^(tts-|gpt-4o-mini-tts|gpt-4o-audio|gpt-4o-mini-audio|gpt-4\.1.*tts)/i;
  return (data.data ?? [])
    .filter((m) => TTS_RE.test(m.id))
    .map((m) => ({ id: m.id, name: m.id, provider: "openai" as const }));
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider || !["openai", "openrouter"].includes(provider)) {
    // edge-tts / gemini 不需要動態拉取模型
    return NextResponse.json({ models: [] });
  }

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
    const models =
      provider === "openrouter"
        ? await fetchOpenRouterTtsModels(apiKey)
        : await fetchOpenAITtsModels(apiKey);
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { error: `無法取得 TTS 模型：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
