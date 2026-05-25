import type { LlmProviderId } from "@courseflow/llm";

export const LLM_PROVIDER_ORDER: LlmProviderId[] = ["openrouter", "openai", "gemini"];

export const PROVIDER_LABELS: Record<LlmProviderId, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  gemini: "Google Gemini",
};
