"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseComposition, WvpPhaseLocks } from "@courseflow/core";
import { getOrderedSteps } from "@courseflow/core";
import type { TtsModel, TtsVoice } from "@courseflow/tts/types";
import { edgeTtsVisibleForLanguage, formatVoiceLabel } from "@courseflow/tts/types";
import { PhaseBottomActions, ProjectPhaseNav } from "@/components/ProjectPhaseNav";
import { useToast } from "@/components/Toast";
import {
  getStepTtsConfig,
  providerNeedsModel,
  TTS_PROVIDER_LABELS,
  upsertStepTtsConfig,
} from "@/lib/step-tts";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";

const TTS_PROVIDER_ORDER = ["openai", "gemini", "openrouter", "edge-tts"] as const;

function pickDefaultTtsSelection(
  language: string,
  voices: TtsVoice[],
  models: Partial<Record<string, TtsModel[]>>,
  providers: string[],
) {
  const preferred =
    TTS_PROVIDER_ORDER.find((provider) => providers.includes(provider)) ??
    TTS_PROVIDER_ORDER.find((provider) => voices.some((voice) => voice.provider === provider)) ??
    (edgeTtsVisibleForLanguage(language) ? "edge-tts" : providers[0] ?? "edge-tts");
  const preferredVoices = voices.filter((voice) => voice.provider === preferred);
  return {
    provider: preferred,
    voiceId: preferredVoices[0]?.id ?? "",
    model: models[preferred]?.[0]?.id ?? "",
  };
}

export function AudioPhaseClient({
  projectId,
  initialComposition,
  initialLocks,
  language,
  initialVoices = [],
  initialModels = {},
  initialProviders = [],
}: {
  projectId: string;
  initialComposition: CourseComposition;
  initialLocks: WvpPhaseLocks;
  language: string;
  initialVoices?: TtsVoice[];
  initialModels?: Partial<Record<string, TtsModel[]>>;
  initialProviders?: string[];
}) {
  const initialDefaults = pickDefaultTtsSelection(
    language,
    initialVoices,
    initialModels,
    initialProviders,
  );

  const [composition, setComposition] = useState(initialComposition);
  const [locks, setLocks] = useState(initialLocks);
  const [voices, setVoices] = useState<TtsVoice[]>(initialVoices);
  const [models, setModels] = useState<Partial<Record<string, TtsModel[]>>>(initialModels);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>(initialProviders);
  const [voicesLoading, setVoicesLoading] = useState(initialVoices.length === 0);
  const [batchProvider, setBatchProvider] = useState(initialDefaults.provider);
  const [batchVoiceId, setBatchVoiceId] = useState(initialDefaults.voiceId);
  const [batchModel, setBatchModel] = useState(initialDefaults.model);
  const [stepIndex, setStepIndex] = useState(0);
  const [batchSynthesizing, setBatchSynthesizing] = useState(false);
  const [stepSynthesizing, setStepSynthesizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const locked = locks.audio;

  const audioGate = useMemo(() => evaluateWvpAudioBuildGate(composition), [composition]);

  const orderedSteps = useMemo(() => getOrderedSteps(composition), [composition]);
  const step = orderedSteps[stepIndex];
  const stepAudio = composition.audio.find((item) => item.stepId === step?.id);

  const availableProviders = useMemo(() => {
    const configured = new Set<string>([
      ...configuredProviders,
      ...voices.map((voice) => voice.provider),
      ...Object.keys(models),
    ]);
    if (edgeTtsVisibleForLanguage(language)) configured.add("edge-tts");
    return TTS_PROVIDER_ORDER.filter((provider) => configured.has(provider));
  }, [configuredProviders, voices, models, language]);

  const voicesForProvider = useCallback(
    (provider: string) => voices.filter((voice) => voice.provider === provider),
    [voices],
  );

  const modelsForProvider = useCallback(
    (provider: string) => models[provider] ?? [],
    [models],
  );

  useEffect(() => {
    if (initialVoices.length > 0) return;

    let cancelled = false;
    setVoicesLoading(true);

    fetch(`/api/tts/voices?language=${encodeURIComponent(language)}`)
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          toast(data.error ?? "無法載入 TTS 語音列表", "error");
          return;
        }

        const list = (data.voices ?? []) as TtsVoice[];
        const modelMap = (data.models ?? {}) as Partial<Record<string, TtsModel[]>>;
        const providers = (data.providers ?? []) as string[];

        setVoices(list);
        setModels(modelMap);
        setConfiguredProviders(providers);

        const defaults = pickDefaultTtsSelection(language, list, modelMap, providers);
        setBatchProvider(defaults.provider);
        setBatchVoiceId(defaults.voiceId);
        setBatchModel(defaults.model);
      })
      .catch(() => {
        if (!cancelled) toast("無法載入 TTS 語音列表", "error");
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在缺少伺服器預載資料時補抓
  }, [language, initialVoices.length]);

  const batchVoices = voicesForProvider(batchProvider);
  const batchModels = modelsForProvider(batchProvider);

  useEffect(() => {
    if (availableProviders.length === 0) return;
    if (!availableProviders.includes(batchProvider as (typeof TTS_PROVIDER_ORDER)[number])) {
      setBatchProvider(availableProviders[0]!);
    }
  }, [availableProviders, batchProvider]);

  useEffect(() => {
    if (!batchVoices.some((voice) => voice.id === batchVoiceId)) {
      setBatchVoiceId(batchVoices[0]?.id ?? "");
    }
  }, [batchProvider, batchVoices, batchVoiceId]);

  useEffect(() => {
    if (!providerNeedsModel(batchProvider)) return;
    if (!batchModels.some((model) => model.id === batchModel)) {
      setBatchModel(batchModels[0]?.id ?? "");
    }
  }, [batchProvider, batchModels, batchModel]);

  const stepDefaults = {
    provider: batchProvider,
    voiceId: batchVoiceId,
    model: providerNeedsModel(batchProvider) ? batchModel : undefined,
  };

  const stepTts = step
    ? getStepTtsConfig(composition, step.id, stepDefaults)
    : null;

  const stepVoices = voicesForProvider(stepTts?.provider ?? batchProvider);
  const stepModels = modelsForProvider(stepTts?.provider ?? batchProvider);

  const updateStepTts = (patch: Partial<NonNullable<typeof stepTts>>) => {
    if (!step || !stepTts) return;
    const next = upsertStepTtsConfig(composition, { ...stepTts, ...patch, stepId: step.id });
    setComposition(next);
  };

  const refreshComposition = useCallback(async () => {
    const proj = await fetch(`/api/projects/${projectId}`).then((response) => response.json());
    if (proj.composition) setComposition(proj.composition);
  }, [projectId]);

  const pollJobRun = useCallback(
    async (jobRunId: string, onDone: () => void, attempt = 0) => {
      const res = await fetch(`/api/job-runs/${jobRunId}`);
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "無法查詢合成狀態", "error");
        onDone();
        return;
      }

      const status = data.job?.status as string | undefined;
      if (status === "completed") {
        await refreshComposition();
        toast("語音合成完成", "success");
        onDone();
        return;
      }
      if (status === "failed") {
        toast(data.job?.error_message ?? "語音合成失敗", "error");
        onDone();
        return;
      }

      if (attempt >= 60) {
        toast(
          "任務仍在佇列中，請確認 courseflow-worker 已啟動（本機：pnpm dev:worker；Render：需部署 worker 服務）",
          "error",
        );
        onDone();
        return;
      }

      window.setTimeout(() => pollJobRun(jobRunId, onDone, attempt + 1), 2000);
    },
    [refreshComposition, toast],
  );

  const synthesize = (
    payload: {
      stepIds?: string[];
      provider: string;
      voiceId: string;
      model?: string;
    },
    onDone?: () => void,
  ) =>
    new Promise<boolean>(async (resolve) => {
      const finish = () => {
        onDone?.();
        resolve(true);
      };

      let res: Response;
      try {
        res = await fetch(`/api/projects/${projectId}/synthesize-audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        toast(e instanceof Error ? e.message : "無法連線至伺服器", "error");
        onDone?.();
        resolve(false);
        return;
      }
      const data = (await res.json()) as {
        error?: string;
        inline?: boolean;
        jobRunId?: string;
      };
      if (!res.ok) {
        toast(data.error ?? "合成失敗", "error");
        onDone?.();
        resolve(false);
        return;
      }

      if (data.inline) {
        toast(
          payload.stepIds?.length === 1 ? "此步驟語音合成完成" : "語音合成完成",
          "success",
        );
        await refreshComposition();
        finish();
        return;
      }

      if (data.jobRunId) {
        toast(
          payload.stepIds?.length === 1
            ? "此步驟語音合成已加入佇列，處理中…"
            : "語音合成已加入佇列，處理中…",
          "info",
        );
        pollJobRun(data.jobRunId, finish);
        return;
      }

      finish();
    });

  const synthesizeBatch = async () => {
    if (!batchVoiceId) {
      toast("請先選擇語音", "error");
      return;
    }
    setBatchSynthesizing(true);
    try {
      await synthesize(
        {
          provider: batchProvider,
          voiceId: batchVoiceId,
          model: providerNeedsModel(batchProvider) ? batchModel : undefined,
        },
        () => setBatchSynthesizing(false),
      );
    } catch {
      setBatchSynthesizing(false);
    }
  };

  const synthesizeCurrentStep = async () => {
    if (!step || !stepTts) return;
    if (!stepTts.voiceId) {
      toast("請先選擇語音", "error");
      return;
    }
    if (!step.script.trim()) {
      toast("此步驟沒有口播稿", "error");
      return;
    }

    setStepSynthesizing(true);
    try {
      const next = upsertStepTtsConfig(composition, stepTts);
      setComposition(next);
      await fetch(`/api/projects/${projectId}/composition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "audio", composition: next }),
      });

      await synthesize(
        {
          stepIds: [step.id],
          provider: stepTts.provider,
          voiceId: stepTts.voiceId,
          model: providerNeedsModel(stepTts.provider) ? stepTts.model : undefined,
        },
        () => setStepSynthesizing(false),
      );
    } catch {
      setStepSynthesizing(false);
    }
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/composition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "audio", composition }),
      });
      if (!res.ok) {
        toast((await res.json()).error ?? "儲存失敗", "error");
        return;
      }
      toast("語音設定已儲存", "success");
    } finally {
      setSaving(false);
    }
  }, [projectId, composition, toast]);

  const unlockPhase = async () => {
    const res = await fetch(`/api/projects/${projectId}/wvp/phases/audio/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "解除鎖定失敗", "error");
      return;
    }
    setLocks(data.wvp_phase_locks);
    router.refresh();
    toast("已解除鎖定", "info");
  };

  return (
    <div className="space-y-6">
      <ProjectPhaseNav
        projectId={projectId}
        current="audio"
        locks={locks}
        onLocksChange={setLocks}
        onBeforeLock={save}
      />

      <section className="cf-card cf-card-padded space-y-3">
        <p
          className={`text-xs ${audioGate.ready ? "text-emerald-600/90" : "text-amber-500/90"}`}
          role="status"
        >
          語音進度：{audioGate.synthesizedSteps}/{audioGate.totalSteps} 步
          {audioGate.ready
            ? "（已完成，可前往「4. 預覽匯出」打包）"
            : "（完成後請至「4. 預覽匯出」打包預覽）"}
        </p>
      </section>

      <section className="cf-card cf-card-padded">
        <h2 className="cf-section-title">批次TTS語音</h2>
        <p className="mt-1 text-xs text-zinc-500">
          使用相同語音一次合成所有步驟。若需逐步調整，請在下方「單步TTS語音」區塊操作。
          {voicesLoading ? " 正在載入語音列表…" : null}
          {!voicesLoading && availableProviders.length === 0 ? (
            <span className="text-amber-400">
              {" "}
              尚無可用提供者：繁中專案可使用 Edge-TTS；或在設定頁填寫 OpenAI / OpenRouter / Gemini API Key。
            </span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs text-zinc-500">
            提供者
            <select
              value={batchProvider}
              onChange={(event) => setBatchProvider(event.target.value)}
              disabled={locked}
              className="cf-select mt-1 w-auto min-w-[140px]"
            >
              {availableProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {TTS_PROVIDER_LABELS[provider] ?? provider}
                </option>
              ))}
            </select>
          </label>

          {providerNeedsModel(batchProvider) ? (
            <label className="block text-xs text-zinc-500">
              模型
              <select
                value={batchModel}
                onChange={(event) => setBatchModel(event.target.value)}
                disabled={locked || batchModels.length === 0}
                className="cf-select mt-1 w-auto min-w-[160px]"
              >
                {batchModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-xs text-zinc-500">
            語音
            <select
              value={batchVoiceId}
              onChange={(event) => setBatchVoiceId(event.target.value)}
              disabled={locked || batchVoices.length === 0}
              className="cf-select mt-1 w-auto min-w-[200px]"
            >
              {batchVoices.map((voice) => (
                <option key={`${voice.provider}-${voice.id}`} value={voice.id}>
                  {formatVoiceLabel(voice)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={locked || batchSynthesizing || !batchVoiceId}
            onClick={synthesizeBatch}
            className="cf-btn cf-btn-primary"
          >
            {batchSynthesizing ? "提交中…" : "批次合成語音"}
          </button>
        </div>
      </section>

      <section className="cf-card cf-card-padded space-y-4">
          <div>
            <h2 className="cf-section-title">單步TTS語音</h2>
            <p className="mt-1 text-xs text-zinc-500">可為每個步驟指定不同語音並單獨合成。</p>
          </div>

          <label className="block text-xs text-zinc-500">
            步驟
            <select
              value={stepIndex}
              onChange={(event) => setStepIndex(Number(event.target.value))}
              className="cf-select mt-1 w-full"
            >
              {orderedSteps.map((item, index) => {
                const hasAudio = composition.audio.some((audio) => audio.stepId === item.id);
                return (
                  <option key={item.id} value={index}>
                    {hasAudio ? "✓ " : ""}
                    {item.screenContent.slice(0, 50) || `步驟 ${index + 1}`}
                  </option>
                );
              })}
            </select>
          </label>

          {step && stepTts ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-xs text-zinc-500">
                  提供者
                  <select
                    value={stepTts.provider}
                    onChange={(event) => {
                      const provider = event.target.value;
                      const nextVoices = voicesForProvider(provider);
                      const nextModels = modelsForProvider(provider);
                      updateStepTts({
                        provider,
                        voiceId: nextVoices[0]?.id ?? "",
                        model: providerNeedsModel(provider) ? nextModels[0]?.id : undefined,
                      });
                    }}
                    disabled={locked}
                    className="cf-select mt-1 w-auto min-w-[140px]"
                  >
                    {availableProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {TTS_PROVIDER_LABELS[provider] ?? provider}
                      </option>
                    ))}
                  </select>
                </label>

                {providerNeedsModel(stepTts.provider) ? (
                  <label className="block text-xs text-zinc-500">
                    模型
                    <select
                      value={stepTts.model ?? ""}
                      onChange={(event) => updateStepTts({ model: event.target.value })}
                      disabled={locked || stepModels.length === 0}
                      className="cf-select mt-1 w-auto min-w-[160px]"
                    >
                      {stepModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block text-xs text-zinc-500">
                  語音
                  <select
                    value={stepTts.voiceId}
                    onChange={(event) => updateStepTts({ voiceId: event.target.value })}
                    disabled={locked || stepVoices.length === 0}
                    className="cf-select mt-1 w-auto min-w-[200px]"
                  >
                    {stepVoices.map((voice) => (
                      <option key={`${voice.provider}-${voice.id}`} value={voice.id}>
                        {formatVoiceLabel(voice)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={locked || stepSynthesizing || !stepTts.voiceId}
                  onClick={synthesizeCurrentStep}
                  className="cf-btn cf-btn-primary"
                >
                  {stepSynthesizing ? "合成中…" : "合成此步驟語音"}
                </button>
                <span className="text-xs text-zinc-500">
                  {stepAudio ? "已有語音檔" : "尚未合成"}
                </span>
              </div>

              {stepAudio?.publicUrl ? (
                <audio controls src={stepAudio.publicUrl} className="w-full" preload="none">
                  您的瀏覽器不支援 audio 播放。
                </audio>
              ) : null}
            </>
          ) : null}

        <div className="border-t border-zinc-800 pt-4">
          <Link href={`/projects/${projectId}/publish`} className="cf-btn cf-btn-secondary">
            下一步：預覽匯出 →
          </Link>
        </div>
      </section>

      <PhaseBottomActions
        projectId={projectId}
        phase="audio"
        locks={locks}
        saving={saving}
        onSave={!locked ? save : undefined}
        onUnlock={unlockPhase}
      />
    </div>
  );
}
