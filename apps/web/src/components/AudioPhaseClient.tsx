"use client";

import Link from "next/link";
import { Mp3Encoder } from "lamejs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseComposition, WvpPhaseLocks } from "@courseflow/core";
import { getOrderedSteps } from "@courseflow/core";
import type { TtsModel, TtsVoice } from "@courseflow/tts/types";
import { edgeTtsVisibleForLanguage, formatVoiceLabel, getTtsVoicesForModel } from "@courseflow/tts/types";
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

type RecordingSession = {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  sink: GainNode;
  stream: MediaStream;
  chunks: Float32Array[];
  sampleRate: number;
  totalSamples: number;
};

function mergeFloat32Chunks(chunks: Float32Array[], totalSamples: number): Float32Array {
  const merged = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function normalizeRecordingError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "找不到可用的麥克風裝置。請確認電腦已接上麥克風，並且目前瀏覽器或遠端環境有提供音訊輸入裝置。若你現在是在共享瀏覽器或遠端桌面中操作，也可能是該環境本身沒有麥克風可用。";
    }
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "瀏覽器尚未取得麥克風權限。請允許此網站使用麥克風後再試一次。";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "麥克風目前無法讀取，可能正被其他程式占用。請關閉其他錄音或通話軟體後再試一次。";
    }
    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return "目前裝置的音訊錄音條件不相容，請改用其他麥克風或直接上傳已錄好的音檔。";
    }
    return error.message || "無法啟用麥克風錄音";
  }
  if (error instanceof Error) {
    if (error.message.includes("Requested device not found")) {
      return "找不到可用的麥克風裝置。請確認電腦已接上麥克風，並且目前瀏覽器或遠端環境有提供音訊輸入裝置。若你現在是在共享瀏覽器或遠端桌面中操作，也可能是該環境本身沒有麥克風可用。";
    }
    return error.message;
  }
  return "無法啟用麥克風錄音";
}

function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return out;
}

function encodeMp3(samples: Float32Array, sampleRate: number): Uint8Array {
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const pcm = float32ToInt16(samples);
  const chunkSize = 1152;
  const parts: Uint8Array[] = [];

  for (let offset = 0; offset < pcm.length; offset += chunkSize) {
    const chunk = pcm.subarray(offset, offset + chunkSize);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) parts.push(new Uint8Array(encoded));
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) parts.push(new Uint8Array(flushed));

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of parts) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return merged;
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
  const [modelsLoading, setModelsLoading] = useState(false);
  const [batchProvider, setBatchProvider] = useState(initialDefaults.provider);
  const [batchVoiceId, setBatchVoiceId] = useState(initialDefaults.voiceId);
  const [batchModel, setBatchModel] = useState(initialDefaults.model);
  const [stepIndex, setStepIndex] = useState(0);
  const [batchSynthesizing, setBatchSynthesizing] = useState(false);
  const [stepSynthesizing, setStepSynthesizing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingSaving, setRecordingSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const locked = locks.audio;
  const recordingRef = useRef<RecordingSession | null>(null);
  const audioUploadInputRef = useRef<HTMLInputElement>(null);

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

  /** 根據選定模型計算對應語音清單（若有已知對應則使用，否則 fallback 到 provider 語音） */
  const voicesForModel = useCallback(
    (provider: string, modelId: string): TtsVoice[] => {
      if (!modelId || !providerNeedsModel(provider)) {
        return voicesForProvider(provider);
      }
      const perModel = getTtsVoicesForModel(modelId, provider as Parameters<typeof getTtsVoicesForModel>[1]);
      // 若 per-model 語音清單與 provider 語音完全相同（都是 OPENAI_TTS_VOICES 映射），
      // 且 provider 本身有更多語音（如邊境語音），優先保留 provider 清單。
      if (perModel.length > 0) return perModel;
      return voicesForProvider(provider);
    },
    [voicesForProvider],
  );

  /** 動態抓取指定 provider 的 TTS 模型清單 */
  const fetchModelsForProvider = useCallback(
    async (provider: string) => {
      if (!providerNeedsModel(provider)) return;
      setModelsLoading(true);
      try {
        const res = await fetch(`/api/tts/models?provider=${encodeURIComponent(provider)}`);
        const data = await res.json();
        if (!res.ok) {
          toast(data.error ?? "無法載入模型列表", "warning");
          return;
        }
        const fetched = (data.models ?? []) as TtsModel[];
        if (fetched.length > 0) {
          setModels((prev) => ({ ...prev, [provider]: fetched }));
        }
      } catch {
        toast("無法連線取得模型列表", "warning");
      } finally {
        setModelsLoading(false);
      }
    },
    [toast],
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

  const batchModels = modelsForProvider(batchProvider);
  const batchVoices = voicesForModel(batchProvider, batchModel);

  // provider 切換時：重新動態拉取 TTS 模型清單
  useEffect(() => {
    void fetchModelsForProvider(batchProvider);
  }, [batchProvider]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [batchProvider, batchModel, batchVoices, batchVoiceId]);

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

  const stepModels = modelsForProvider(stepTts?.provider ?? batchProvider);
  const stepVoices = voicesForModel(stepTts?.provider ?? batchProvider, stepTts?.model ?? "");

  const updateStepTts = (patch: Partial<NonNullable<typeof stepTts>>) => {
    if (!step || !stepTts) return;
    const next = upsertStepTtsConfig(composition, { ...stepTts, ...patch, stepId: step.id });
    setComposition(next);
  };

  const clearUnsavedRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordedDurationMs(0);
    setRecordingError(null);
  }, []);

  useEffect(() => {
    clearUnsavedRecording();
  }, [step?.id, clearUnsavedRecording]);

  useEffect(() => {
    if (!recordedBlob) {
      setRecordedPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const nextUrl = URL.createObjectURL(recordedBlob);
    setRecordedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });

    return () => URL.revokeObjectURL(nextUrl);
  }, [recordedBlob]);

  useEffect(() => {
    return () => {
      const active = recordingRef.current;
      if (!active) return;
      active.processor.disconnect();
      active.source.disconnect();
      active.sink.disconnect();
      active.stream.getTracks().forEach((track) => track.stop());
      void active.context.close();
      recordingRef.current = null;
    };
  }, []);

  const refreshComposition = useCallback(async () => {
    const proj = await fetch(`/api/projects/${projectId}`).then((response) => response.json());
    if (proj.composition) setComposition(proj.composition);
  }, [projectId]);

  const uploadAudioAsset = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "audio");
      const res = await fetch(`/api/projects/${projectId}/upload-asset`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string; storagePath?: string; publicUrl?: string };
      if (!res.ok || !data.storagePath || !data.publicUrl) {
        throw new Error(data.error ?? "音檔上傳失敗");
      }
      return { storagePath: data.storagePath, publicUrl: data.publicUrl };
    },
    [projectId],
  );

  const pollJobRun = useCallback(
    async (jobRunId: string, onDone: () => void, attempt = 0) => {
      let res: Response;
      let data: { error?: string; job?: { status?: string; error_message?: string | null } } = {};

      try {
        res = await fetch(`/api/job-runs/${jobRunId}`);
        const text = await res.text();
        if (text.trim()) {
          const parsed: unknown = JSON.parse(text);
          if (parsed && typeof parsed === "object") {
            data = parsed as { error?: string; job?: { status?: string; error_message?: string | null } };
          }
        }
      } catch {
        if (attempt >= 60) {
          toast("任務狀態查詢逾時，請稍後重新整理頁面確認結果", "error");
          onDone();
          return;
        }
        window.setTimeout(() => void pollJobRun(jobRunId, onDone, attempt + 1), 2000);
        return;
      }

      if (!res.ok) {
        if ([502, 503, 504].includes(res.status) && attempt < 60) {
          window.setTimeout(() => void pollJobRun(jobRunId, onDone, attempt + 1), 2000);
          return;
        }
        toast(data.error ?? "無法查詢合成狀態", "error");
        onDone();
        return;
      }

      const status = data.job?.status as string | undefined;
      if (status === "completed") {
        await refreshComposition();
        toast("語音合成完成", "success", { taskComplete: true });
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
          { taskComplete: true },
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

  const handleRecordedFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !step) return;

    if (!file.type.startsWith("audio/")) {
      setRecordingError("請選擇音訊檔案，例如 mp3、wav、m4a 或 webm。");
      return;
    }

    setRecordingSaving(true);
    setRecordingError(null);

    try {
      const uploaded = await uploadAudioAsset(file);
      const nextEntry = {
        stepId: step.id,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.publicUrl,
        durationMs: recordedDurationMs > 0 ? recordedDurationMs : (step.estimatedSeconds ? step.estimatedSeconds * 1000 : 3000),
      };
      const nextComposition = {
        ...composition,
        audio: [...composition.audio.filter((item) => item.stepId !== step.id), nextEntry],
      };

      const res = await fetch(`/api/projects/${projectId}/composition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "audio", composition: nextComposition }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "儲存音檔失敗");
      }

      setComposition(nextComposition);
      clearUnsavedRecording();
      toast("音檔已上傳並套用到此步驟", "success", { taskComplete: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "音檔上傳失敗";
      setRecordingError(message);
      toast(message, "error");
    } finally {
      setRecordingSaving(false);
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

  const startRecording = async () => {
    if (locked) return;
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("目前瀏覽器不支援麥克風錄音。請使用最新版 Chrome 或 Edge。");
      return;
    }

    setRecordingBusy(true);
    setRecordingError(null);
    clearUnsavedRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new window.AudioContext();
      await context.resume();

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const sink = context.createGain();
      sink.gain.value = 0;

      const session: RecordingSession = {
        context,
        source,
        processor,
        sink,
        stream,
        chunks: [],
        sampleRate: context.sampleRate,
        totalSamples: 0,
      };

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const copied = new Float32Array(input.length);
        copied.set(input);
        session.chunks.push(copied);
        session.totalSamples += copied.length;
      };

      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);

      recordingRef.current = session;
      setRecording(true);
    } catch (error) {
      setRecordingError(normalizeRecordingError(error));
    } finally {
      setRecordingBusy(false);
    }
  };

  const stopRecording = async () => {
    const session = recordingRef.current;
    if (!session) return;

    setRecordingBusy(true);
    setRecording(false);
    recordingRef.current = null;

    try {
      session.processor.disconnect();
      session.source.disconnect();
      session.sink.disconnect();
      session.stream.getTracks().forEach((track) => track.stop());
      await session.context.close();

      if (session.totalSamples <= 0) {
        setRecordingError("沒有錄到聲音，請再試一次。");
        return;
      }

      const merged = mergeFloat32Chunks(session.chunks, session.totalSamples);
      const mp3Bytes = encodeMp3(merged, session.sampleRate);
      if (mp3Bytes.length === 0) {
        setRecordingError("錄音轉檔失敗，請再試一次。");
        return;
      }

      const mp3Buffer = new ArrayBuffer(mp3Bytes.byteLength);
      new Uint8Array(mp3Buffer).set(mp3Bytes);
      setRecordedBlob(new Blob([mp3Buffer], { type: "audio/mpeg" }));
      setRecordedDurationMs(Math.max(1, Math.round((session.totalSamples / session.sampleRate) * 1000)));
      toast("錄音完成，可先試聽再存檔", "success");
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "停止錄音失敗");
    } finally {
      setRecordingBusy(false);
    }
  };

  const saveRecordedAudio = async () => {
    if (!step || !recordedBlob) return;

    setRecordingSaving(true);
    setRecordingError(null);
    try {
      const file = new File([recordedBlob], `${step.id}.mp3`, { type: "audio/mpeg" });
      const uploaded = await uploadAudioAsset(file);
      const nextEntry = {
        stepId: step.id,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.publicUrl,
        durationMs: recordedDurationMs,
      };
      const nextComposition = {
        ...composition,
        audio: [...composition.audio.filter((item) => item.stepId !== step.id), nextEntry],
      };

      const res = await fetch(`/api/projects/${projectId}/composition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "audio", composition: nextComposition }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "儲存錄音失敗");
      }

      setComposition(nextComposition);
      clearUnsavedRecording();
      toast("錄音已存檔並套用到此步驟", "success", { taskComplete: true });
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "錄音存檔失敗");
      toast(error instanceof Error ? error.message : "錄音存檔失敗", "error");
    } finally {
      setRecordingSaving(false);
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
                onChange={(event) => {
                  const modelId = event.target.value;
                  setBatchModel(modelId);
                  // 切換模型時重算語音，並選第一個
                  const nextVoices = voicesForModel(batchProvider, modelId);
                  if (nextVoices.length > 0 && !nextVoices.some((v) => v.id === batchVoiceId)) {
                    setBatchVoiceId(nextVoices[0]!.id);
                  }
                }}
                disabled={locked || modelsLoading || batchModels.length === 0}
                className="cf-select mt-1 w-auto min-w-[160px]"
              >
                {modelsLoading ? (
                  <option value="">載入中…</option>
                ) : (
                  batchModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))
                )}
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

          {step && stepTts ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-xs text-zinc-500">
                  提供者
                  <select
                    value={stepTts.provider}
                    onChange={(event) => {
                      const provider = event.target.value;
                      const nextModels = modelsForProvider(provider);
                      const firstModel = providerNeedsModel(provider) ? nextModels[0]?.id ?? "" : undefined;
                      const nextVoices = voicesForModel(provider, firstModel ?? "");
                      updateStepTts({
                        provider,
                        voiceId: nextVoices[0]?.id ?? "",
                        model: firstModel,
                      });
                      void fetchModelsForProvider(provider);
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
                      onChange={(event) => {
                        const modelId = event.target.value;
                        const nextVoices = voicesForModel(stepTts.provider, modelId);
                        updateStepTts({
                          model: modelId,
                          voiceId: nextVoices[0]?.id ?? stepTts.voiceId,
                        });
                      }}
                      disabled={locked || modelsLoading || stepModels.length === 0}
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
            </>
          ) : null}

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
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-black/20 p-3">
                <div className="text-xs text-zinc-500">目前步驟口播稿</div>
                <textarea
                  value={step.script}
                  readOnly
                  rows={5}
                  className="w-full rounded border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-200"
                />
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-800 bg-black/20 p-3">
                <div>
                  <div className="text-sm text-zinc-100">真人配音錄音</div>
                  <p className="mt-1 text-xs text-zinc-500">
                    使用瀏覽器麥克風錄下這一步的口播。存檔後會覆蓋此步驟目前的語音檔。
                  </p>
                  <input
                    ref={audioUploadInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                    className="hidden"
                    onChange={(event) => void handleRecordedFilePick(event)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={locked || recordingBusy || recordingSaving || recording}
                    onClick={() => void startRecording()}
                    className="cf-btn cf-btn-secondary"
                  >
                    {recordingBusy && !recording ? "啟動中…" : "開始錄音"}
                  </button>
                  <button
                    type="button"
                    disabled={locked || recordingBusy || !recording}
                    onClick={() => void stopRecording()}
                    className="cf-btn cf-btn-primary"
                  >
                    {recordingBusy && recording ? "停止中…" : "停止錄音"}
                  </button>
                  <button
                    type="button"
                    disabled={locked || recording || recordingBusy || (!recordedBlob && !recordingError)}
                    onClick={clearUnsavedRecording}
                    className="cf-btn cf-btn-secondary"
                  >
                    重新錄製
                  </button>
                  <button
                    type="button"
                    disabled={locked || recording || recordingBusy || recordingSaving || !recordedBlob}
                    onClick={() => void saveRecordedAudio()}
                    className="cf-btn cf-btn-primary"
                  >
                    {recordingSaving ? "存檔中…" : "錄音存檔"}
                  </button>
                  <button
                    type="button"
                    disabled={locked || recording || recordingBusy || recordingSaving}
                    onClick={() => audioUploadInputRef.current?.click()}
                    className="cf-btn cf-btn-secondary"
                  >
                    上傳已錄音檔
                  </button>
                  <span className="text-xs text-zinc-500">
                    {recording
                      ? "錄音中…"
                      : recordedBlob
                        ? `已錄製 ${Math.max(1, Math.round(recordedDurationMs / 1000))} 秒，可試聽或存檔`
                        : "尚未錄音"}
                  </span>
                </div>

                {recordingError ? (
                  <p className="text-xs text-rose-400">{recordingError}</p>
                ) : null}

                {recordedPreviewUrl ? (
                  <div className="space-y-1">
                    <div className="text-xs text-zinc-500">未存檔錄音預覽</div>
                    <audio controls src={recordedPreviewUrl} className="w-full" preload="none">
                      您的瀏覽器不支援 audio 播放。
                    </audio>
                  </div>
                ) : null}
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
