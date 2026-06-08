import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/crypto";
import type { TtsModel, TtsProviderId } from "@courseflow/tts/types";
import { getTtsVoicesForModel } from "@courseflow/tts/types";
import {
  fetchOpenRouterTtsCatalog,
  filterChineseTtsModelsWithVoices,
  filterChineseVoices,
} from "@courseflow/tts";

export const runtime = "nodejs";

async function fetchOpenAITtsModels(apiKey: string): Promise<TtsModel[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = (await res.json()) as { data: { id: string }[] };
  const TTS_RE = /^(tts-|gpt-4o-mini-tts|gpt-4o-audio|gpt-4o-mini-audio|gpt-4\.1.*tts)/i;
  const models = (data.data ?? [])
    .filter((m) => TTS_RE.test(m.id))
    .map((m) => ({ id: m.id, name: m.id, provider: "openai" as const }));
  return filterChineseTtsModelsWithVoices(models, (modelId, provider) =>
    filterChineseVoices(getTtsVoicesForModel(modelId, provider as TtsProviderId)),
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider || !["openai", "openrouter"].includes(provider)) {
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
        ? await fetchOpenRouterTtsCatalog(apiKey)
        : await fetchOpenAITtsModels(apiKey);
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { error: `無法取得 TTS 模型：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
