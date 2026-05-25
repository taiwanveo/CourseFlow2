import type { SupabaseClient } from "@supabase/supabase-js";
import type { LlmProviderId } from "@courseflow/llm";
import { LLM_PROVIDER_ORDER, PROVIDER_LABELS } from "@/lib/llm-providers.constants";

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
  | { ok: true; provider: LlmProviderId; encryptedKey: string }
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
    .select("encrypted_key")
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

  return { ok: true, provider, encryptedKey: keyRow.encrypted_key };
}
