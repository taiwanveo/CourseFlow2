"use client";

import { useEffect, useState } from "react";
import type { LlmProviderId } from "@courseflow/llm";
import { LLM_PROVIDER_ORDER, PROVIDER_LABELS } from "@/lib/llm-providers.constants";

export function useConfiguredLlmProviders() {
  const [providers, setProviders] = useState<LlmProviderId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((d) => {
        const configured = new Set(
          ((d.providers ?? []) as { provider: string }[]).map((p) => p.provider),
        );
        setProviders(LLM_PROVIDER_ORDER.filter((p) => configured.has(p)));
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    providers,
    loading,
    labels: PROVIDER_LABELS,
    defaultProvider: providers[0] ?? null,
  };
}
