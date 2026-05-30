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

async function fetchOpenRouterTtsModels(apiKey: string): Promise<TtsModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 300 },
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
  const seen = new Set<string>();
  const result: TtsModel[] = [];

  // 1. 預填「已知 TTS 模型」——只有在 API 確認存在時才加入，防止幽靈模型出現
  for (const known of OPENROUTER_TTS_MODELS) {
    const found = all.find((m) => m.id === known.id);
    if (!found) continue; // API 找不到就跳過，不強制顯示
    result.push({ id: found.id, name: found.name || known.name, provider: "openrouter" as const });
    seen.add(found.id);
  }

  // 2. 動態拉取：modality 輸出含 audio 且非音樂模型
  for (const m of all) {
    if (seen.has(m.id)) continue;
    const mod = m.architecture?.modality ?? "";
    const outputPart = mod.split("->")[1] ?? "";
    const hasAudioOutput = outputPart.toLowerCase().includes("audio");
    const isMusicModel = MUSIC_MODEL_PATTERN.test(m.id) || MUSIC_MODEL_PATTERN.test(m.name);
    const isTtsById = TTS_ID_PATTERN.test(m.id);
    if ((hasAudioOutput && !isMusicModel) || isTtsById) {
      result.push({ id: m.id, name: m.name || m.id, provider: "openrouter" as const });
      seen.add(m.id);
    }
  }

  return result;
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
