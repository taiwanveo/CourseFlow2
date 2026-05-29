"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StepIllustrationEntry } from "@/lib/wvp-craft-illustrations";
import { useToast } from "@/components/Toast";

type ChapterState = {
  wvpChapterId: string;
  templateKind?: string;
  steps: StepIllustrationEntry[];
};

function imageUrl(projectId: string, wvpChapterId: string, stepIndex: number, bust: number) {
  return `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations/${stepIndex}/image?t=${bust}`;
}

export function CraftIllustrationStudio({
  projectId,
  wvpChapterId,
  chapterTitle,
  disabled,
  hasImageStyle,
  onOpenStylePicker,
}: {
  projectId: string;
  wvpChapterId: string;
  chapterTitle: string;
  disabled?: boolean;
  hasImageStyle: boolean;
  onOpenStylePicker?: () => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ChapterState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyStep, setBusyStep] = useState<number | "plan" | "batch" | null>(null);
  const [planningStep, setPlanningStep] = useState<number | null>(null);
  const [imageBust, setImageBust] = useState(0);
  const regenQueue = useRef<number[]>([]);
  const processingQueue = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "無法載入配圖狀態");
    setState(data as ChapterState);
  }, [projectId, wvpChapterId]);

  useEffect(() => {
    setState(null);
    void refresh().catch(() => undefined);
  }, [refresh, wvpChapterId]);

  const savePrompt = async (stepIndex: number, promptForApi: string, confirm?: boolean) => {
    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patches: [{ stepIndex, promptForApi, confirm }] }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "儲存失敗");
    setState(data as ChapterState);
  };

  const generateSteps = async (indices: number[]) => {
    if (indices.length === 0) return;
    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          indices.length === 1 ? { stepIndex: indices[0] } : { allConfirmed: true },
        ),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "生圖失敗");
    setState((prev) => ({
      ...(prev ?? { wvpChapterId, steps: [] }),
      steps: data.steps as StepIllustrationEntry[],
    }));
    setImageBust(Date.now());
    return data.generated as number;
  };

  const processRegenQueue = useCallback(async () => {
    if (processingQueue.current) return;
    processingQueue.current = true;
    try {
      while (regenQueue.current.length > 0) {
        const stepIndex = regenQueue.current.shift()!;
        setBusyStep(stepIndex);
        try {
          await generateSteps([stepIndex]);
        } catch (e) {
          toast(e instanceof Error ? e.message : "重新生圖失敗", "error");
        }
      }
      await refresh();
    } finally {
      processingQueue.current = false;
      setBusyStep(null);
    }
  }, [projectId, wvpChapterId, toast, refresh]);

  const enqueueRegen = (stepIndex: number) => {
    if (!regenQueue.current.includes(stepIndex)) {
      regenQueue.current.push(stepIndex);
      toast(`已將步驟 ${stepIndex + 1} 加入重新生圖佇列`, "info");
    }
    void processRegenQueue();
  };

  const planPrompts = async (stepIndex?: number) => {
    if (!hasImageStyle) {
      toast("請先選擇生圖風格主題", "error");
      onOpenStylePicker?.();
      return;
    }
    if (typeof stepIndex === "number") {
      setPlanningStep(stepIndex);
    } else {
      setBusyStep("plan");
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations/plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            typeof stepIndex === "number" ? { stepIndex } : {},
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "規劃提示詞失敗");
      setState(data as ChapterState);
      toast(
        typeof stepIndex === "number"
          ? `已更新步驟 ${stepIndex + 1} 提示詞`
          : "已產生各步生圖提示詞，請確認或修改後再生圖",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "規劃失敗", "error");
    } finally {
      setBusyStep(null);
      setPlanningStep(null);
      setLoading(false);
    }
  };

  const generateOne = async (stepIndex: number) => {
    setBusyStep(stepIndex);
    try {
      await savePrompt(stepIndex, state?.steps.find((s) => s.stepIndex === stepIndex)?.promptForApi ?? "", true);
      const n = await generateSteps([stepIndex]);
      toast(n ? `步驟 ${stepIndex + 1} 配圖完成` : "生圖未完成", n ? "success" : "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "生圖失敗", "error");
    } finally {
      setBusyStep(null);
    }
  };

  const generateAllConfirmed = async () => {
    const steps = (state?.steps ?? []).filter(
      (s) =>
        s.needsImage !== false &&
        (s.imageSource ?? "ai") === "ai" &&
        s.batchSelected !== false &&
        s.promptForApi.trim(),
    );
    if (!steps.length) {
      toast("沒有可生圖的步驟", "error");
      return;
    }
    setBusyStep("batch");
    let ok = 0;
    try {
      for (const s of steps) {
        if (!s.confirmedAt) {
          await savePrompt(s.stepIndex, s.promptForApi, true);
        }
        setBusyStep(s.stepIndex);
        try {
          const n = await generateSteps([s.stepIndex]);
          if (n) ok += 1;
        } catch (e) {
          toast(
            `步驟 ${s.stepIndex + 1}：${e instanceof Error ? e.message : "生圖失敗"}`,
            "error",
          );
        }
      }
      await refresh();
      toast(`批次完成：${ok}/${steps.length} 張`, "success", { taskComplete: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "批次生圖失敗", "error");
    } finally {
      setBusyStep(null);
    }
  };

  const aiSteps = state?.steps.filter((s) => s.needsImage !== false) ?? [];
  const doneCount = aiSteps.filter(
    (s) => s.status === "done" || s.imageWritten || (s.imageSource === "animation" && s.animationHtml),
  ).length;

  const generateAnimation = async (stepIndex: number, animationPrompt?: string) => {
    setBusyStep(stepIndex);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations/animate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIndex, animationPrompt }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成動畫失敗");
      setState(data as ChapterState);
      toast(`步驟 ${stepIndex + 1} 解說動畫生成完成`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "生成動畫失敗", "error");
    } finally {
      setBusyStep(null);
    }
  };

  const patchStep = async (
    stepIndex: number,
    patch: Partial<{
      promptForApi: string;
      confirm: boolean;
      needsImage: boolean;
      imageSource: "ai" | "upload" | "animation";
      batchSelected: boolean;
      animationHtml: string | null;
    }>,
  ) => {
    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patches: [{ stepIndex, ...patch }] }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "更新失敗");
    setState(data as ChapterState);
  };

  const uploadStepImage = async (stepIndex: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations/${stepIndex}/image`,
      { method: "POST", body: form },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "上傳失敗");
    setState(data as ChapterState);
    setImageBust(Date.now());
  };

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-zinc-200">AI 配圖工作室</h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            {chapterTitle} — 先確認生圖提示詞，再逐張或批次生圖；生成後即時顯示，可排隊重新生成。
          </p>
          {aiSteps.length > 0 ? (
            <p className="mt-1 text-[11px] text-zinc-600">
              需配圖 {aiSteps.length} 步 · 已完成 {doneCount}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cf-btn cf-btn-secondary cf-btn-sm"
            disabled={disabled || loading || busyStep !== null}
            onClick={() => void planPrompts()}
          >
            {busyStep === "plan" ? "規劃中…" : "產生提示詞"}
          </button>
          <button
            type="button"
            className="cf-btn cf-btn-primary cf-btn-sm"
            disabled={disabled || !aiSteps.length || busyStep !== null}
            onClick={() => void generateAllConfirmed()}
          >
            {busyStep === "batch" ? "批次生圖中…" : "批次生圖（已確認）"}
          </button>
        </div>
      </div>

      {!state?.steps.length ? (
        <p className="text-xs text-zinc-500">
          {loading ? "載入中…" : "請先匯入口播，再按「產生提示詞」。"}
        </p>
      ) : (
        <ul className="space-y-4">
          {state.steps.map((step) => (
            <li
              key={step.stepIndex}
              className="space-y-2 rounded border border-zinc-800/80 bg-zinc-900/30 p-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  步驟 {step.stepIndex + 1}
                  {step.recommendedOutput === "chapter-divider" ? (
                    <span className="ml-2 text-zinc-500">（章節分隔頁）</span>
                  ) : step.status === "skip" ? (
                    <span className="ml-2 text-zinc-500">（略過：{step.error ?? step.recommendedOutput}）</span>
                  ) : null}
                  {step.status === "generating" || busyStep === step.stepIndex ? (
                    <span className="ml-2 text-amber-400/90">生圖中…</span>
                  ) : null}
                  {step.status === "done" || step.imageWritten ? (
                    <span className="ml-2 text-emerald-400/90">已完成</span>
                  ) : null}
                  {step.status === "failed" ? (
                    <span className="ml-2 text-red-400/90">失敗</span>
                  ) : null}
                </span>
                {
                  <div className="flex flex-wrap gap-1">
                    <label className="cf-chip text-[10px] text-zinc-300">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={step.needsImage !== false}
                        disabled={disabled || busyStep !== null || planningStep !== null}
                        onChange={(e) =>
                          void patchStep(step.stepIndex, { needsImage: e.target.checked }).catch(
                            (err) => toast(err instanceof Error ? err.message : "更新失敗", "error"),
                          )
                        }
                      />
                      需要配圖
                    </label>
                    <select
                      className="cf-input h-8 text-xs"
                      value={step.imageSource ?? "ai"}
                      disabled={
                        disabled ||
                        step.needsImage === false ||
                        busyStep !== null ||
                        planningStep !== null
                      }
                      onChange={(e) =>
                        void patchStep(step.stepIndex, {
                          imageSource: e.target.value as "ai" | "upload" | "animation",
                        }).catch((err) =>
                          toast(err instanceof Error ? err.message : "更新失敗", "error"),
                        )
                      }
                    >
                      <option value="ai">AI 生圖</option>
                      <option value="upload">自行上傳</option>
                      <option value="animation">AI 解說動畫</option>
                    </select>
                    <label className="cf-chip text-[10px] text-zinc-300">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={step.batchSelected !== false}
                        disabled={
                          disabled ||
                          step.needsImage === false ||
                          (step.imageSource ?? "ai") !== "ai" ||
                          busyStep !== null ||
                          planningStep !== null
                        }
                        onChange={(e) =>
                          void patchStep(step.stepIndex, { batchSelected: e.target.checked }).catch(
                            (err) => toast(err instanceof Error ? err.message : "更新失敗", "error"),
                          )
                        }
                      />
                      納入批次
                    </label>
                    <button
                      type="button"
                      className="cf-btn cf-btn-secondary cf-btn-sm"
                      disabled={disabled || loading || busyStep !== null || planningStep !== null}
                      onClick={() => void planPrompts(step.stepIndex)}
                    >
                      {planningStep === step.stepIndex ? "產生中…" : "產生提示詞"}
                    </button>
                    <button
                      type="button"
                      className="cf-btn cf-btn-secondary cf-btn-sm"
                      disabled={disabled || loading || busyStep !== null || planningStep !== null}
                      onClick={() =>
                        void savePrompt(step.stepIndex, step.promptForApi, true).then(() =>
                          toast(`步驟 ${step.stepIndex + 1} 提示詞已確認`, "success"),
                        )
                      }
                    >
                      確認提示詞
                    </button>
                    <button
                      type="button"
                      className="cf-btn cf-btn-primary cf-btn-sm"
                      disabled={
                        disabled ||
                        step.needsImage === false ||
                        (step.imageSource ?? "ai") !== "ai" ||
                        loading ||
                        planningStep !== null ||
                        busyStep !== null ||
                        !step.promptForApi.trim()
                      }
                      onClick={() => void generateOne(step.stepIndex)}
                    >
                      生圖
                    </button>
                    {(step.imageWritten || step.status === "done") && (
                      <button
                        type="button"
                        className="cf-btn cf-btn-secondary cf-btn-sm"
                        disabled={disabled || loading || planningStep !== null || busyStep !== null}
                        onClick={() => enqueueRegen(step.stepIndex)}
                      >
                        重新生圖
                      </button>
                    )}
                    {(step.needsImage !== false && (step.imageSource ?? "ai") === "upload") && (
                      <label className="cf-btn cf-btn-secondary cf-btn-sm">
                        上傳圖片
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.bmp,.gif,image/jpeg,image/png,image/gif,image/bmp"
                          className="hidden"
                          disabled={disabled || loading || busyStep !== null || planningStep !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void uploadStepImage(step.stepIndex, file)
                              .then(() => toast(`步驟 ${step.stepIndex + 1} 圖片已上傳`, "success"))
                              .catch((err) =>
                                toast(err instanceof Error ? err.message : "上傳失敗", "error"),
                              )
                              .finally(() => {
                                e.currentTarget.value = "";
                              });
                          }}
                        />
                      </label>
                    )}
                  </div>
                }
              </div>
              {step.screenSnippet ? (
                <p className="text-[10px] text-zinc-600">螢幕：{step.screenSnippet}</p>
              ) : null}
              {step.needsImage !== false && (step.imageSource ?? "ai") === "ai" ? (
                <label className="block text-[10px] text-zinc-500">
                  生圖提示詞（送進 AI 的真實內容）
                  <textarea
                    className="cf-input mt-1 min-h-[100px] w-full font-mono text-[11px] leading-snug"
                    disabled={disabled || busyStep === step.stepIndex}
                    value={step.promptForApi}
                    onChange={(e) => {
                      const v = e.target.value;
                      setState((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          steps: prev.steps.map((s) =>
                            s.stepIndex === step.stepIndex ? { ...s, promptForApi: v } : s,
                          ),
                        };
                      });
                    }}
                    onBlur={() => {
                      void savePrompt(step.stepIndex, step.promptForApi).catch(() => undefined);
                    }}
                  />
                </label>
              ) : null}
              {step.needsImage !== false && (step.imageSource ?? "ai") === "animation" ? (
                <AnimationPanel
                  step={step}
                  disabled={disabled || loading || busyStep !== null}
                  busy={busyStep === step.stepIndex}
                  onGenerate={(prompt) => void generateAnimation(step.stepIndex, prompt)}
                />
              ) : null}
              {(step.imageWritten || step.status === "done") && step.status !== "skip" && (step.imageSource ?? "ai") !== "animation" ? (
                <div className="overflow-hidden rounded border border-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(projectId, wvpChapterId, step.stepIndex, imageBust)}
                    alt={`步驟 ${step.stepIndex + 1} 配圖`}
                    className="aspect-video w-full object-cover"
                  />
                </div>
              ) : null}
              {step.error && step.status === "failed" ? (
                <p className="text-[10px] text-red-400/90">{step.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AnimationPanel({
  step,
  disabled,
  busy,
  onGenerate,
}: {
  step: StepIllustrationEntry;
  disabled: boolean;
  busy: boolean;
  onGenerate: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState(
    step.animationHtml ? "" : (step.promptForApi ?? ""),
  );

  return (
    <div className="space-y-2">
      <label className="block text-[10px] text-zinc-500">
        動畫描述（讓 AI 知道要解說什麼）
        <textarea
          className="cf-input mt-1 min-h-[80px] w-full text-[11px] leading-snug"
          disabled={disabled || busy}
          value={prompt}
          placeholder="例如：用動畫解說這個概念的三個步驟，以流程圖方式呈現..."
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <button
        className="cf-btn cf-btn-primary cf-btn-sm"
        disabled={disabled || busy}
        onClick={() => onGenerate(prompt)}
      >
        {busy ? "生成中…" : step.animationHtml ? "重新生成動畫" : "AI 生成動畫"}
      </button>
      {step.animationHtml ? (
        <div className="relative aspect-video w-full overflow-hidden rounded border border-zinc-700">
          <iframe
            srcDoc={step.animationHtml}
            className="absolute inset-0 h-full w-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title="動畫預覽"
          />
        </div>
      ) : null}
    </div>
  );
}
