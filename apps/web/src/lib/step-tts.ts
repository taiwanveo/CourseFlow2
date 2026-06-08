import type { CourseComposition, StepTtsConfig } from "@courseflow/core";
import { resolveTtsModel, type TtsProviderId } from "@courseflow/tts/types";
export type TtsDefaults = {
  provider: string;
  voiceId: string;
  model?: string;
};

function normalizeStepTts(config: StepTtsConfig): StepTtsConfig {
  const provider = config.provider as TtsProviderId;
  if (!providerNeedsModel(provider)) {
    return { ...config, model: undefined };
  }
  return {
    ...config,
    model: resolveTtsModel(provider, config.model),
  };
}

export function getStepTtsConfig(
  composition: CourseComposition,
  stepId: string,
  defaults: TtsDefaults,
): StepTtsConfig {
  const saved = composition.stepTts?.find((item) => item.stepId === stepId);
  if (saved) return normalizeStepTts(saved);
  return normalizeStepTts({
    stepId,
    provider: defaults.provider,
    voiceId: defaults.voiceId,
    model: defaults.model,
  });
}
export function upsertStepTtsConfig(
  composition: CourseComposition,
  config: StepTtsConfig,
): CourseComposition {
  const others = (composition.stepTts ?? []).filter((item) => item.stepId !== config.stepId);
  return {
    ...composition,
    stepTts: [...others, normalizeStepTts(config)],
  };
}
export function providerNeedsModel(provider: string) {
  return provider === "openai" || provider === "openrouter";
}

export const TTS_PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  "edge-tts": "Edge-TTS（中文）",
};
