import type { SupabaseClient } from "@supabase/supabase-js";
import type { LlmProviderId } from "@courseflow/llm";
import { LLM_PROVIDER_ORDER, PROVIDER_LABELS } from "@/lib/llm-providers.constants";

// ─── 各 provider 在未設定模型偏好時的硬編碼後備值 ───────────────────────────
export const PROVIDER_TEXT_FALLBACK: Record<LlmProviderId, string> = {
  openai:     "gpt-4o",
  openrouter: "openai/gpt-4o",
  gemini:     "gemini-2.0-flash",
};
export const PROVIDER_IMAGE_FALLBACK: Partial<Record<LlmProviderId, string>> = {
  openai:     "dall-e-3",
  // OpenRouter 預設使用 Gemini image model（DALL-E 3 需透過 OpenAI 直接呼叫）
  openrouter: "google/gemini-2.5-flash-image",
};

/** 解析最終使用的文字生成模型（textModel → defaultModel → 硬編碼後備） */
export function resolveEffectiveTextModel(
  provider: LlmProviderId,
  textModel: string | null | undefined,
  defaultModel: string | null | undefined,
): string {
  return (
    textModel?.trim() ||
    defaultModel?.trim() ||
    PROVIDER_TEXT_FALLBACK[provider] ||
    "gpt-4o"
  );
}

/** 解析最終使用的圖片生成模型（imageModel → 硬編碼後備，不用 defaultModel 避免誤用文字模型） */
export function resolveEffectiveImageModel(
  provider: LlmProviderId,
  imageModel: string | null | undefined,
  _defaultModel?: string | null | undefined,
): string {
  return (
    imageModel?.trim() ||
    PROVIDER_IMAGE_FALLBACK[provider] ||
    "dall-e-3"
  );
}

export async function listConfiguredLlmProviders(
  supabase: SupabaseClient,
  userId: string,
): Promise<LlmProviderId[]> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", userId);

  const configured = new Set((data ?? []).map((row) => row.provider as LlmProviderId));
  return LLM_PROVIDER_ORDER.filter((p) => configured.has(p));
}

export async function resolveLlmProvider(
  supabase: SupabaseClient,
  userId: string,
  requested?: LlmProviderId,
): Promise<
  | {
      ok: true;
      provider: LlmProviderId;
      encryptedKey: string;
      defaultModel: string | null;
      textModel: string | null;
      imageModel: string | null;
    }
  | { ok: false; error: string; status: number }
> {
  const configured = await listConfiguredLlmProviders(supabase, userId);

  if (configured.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "請先在設定頁填寫至少一組 LLM API Key（OpenRouter / OpenAI / Gemini）",
    };
  }

  const provider = (requested && configured.includes(requested) ? requested : configured[0])!;

  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("encrypted_key, default_model, text_model, image_model")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (!keyRow?.encrypted_key) {
    return {
      ok: false,
      status: 400,
      error: `請先在設定頁填寫 ${PROVIDER_LABELS[provider]} API Key`,
    };
  }

  return {
    ok: true,
    provider,
    encryptedKey: keyRow.encrypted_key,
    defaultModel: (keyRow as { default_model?: string | null }).default_model ?? null,
    textModel:    (keyRow as { text_model?: string | null }).text_model    ?? null,
    imageModel:   (keyRow as { image_model?: string | null }).image_model  ?? null,
  };
}
