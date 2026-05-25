"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhaseBottomActions, ProjectPhaseNav } from "@/components/ProjectPhaseNav";
import { OutlineEditor } from "@/components/OutlineEditor";
import type { CourseComposition, PhaseLocks } from "@courseflow/core";
import type { LlmProviderId } from "@courseflow/llm";
import { useToast } from "@/components/Toast";
import { useConfiguredLlmProviders } from "@/hooks/useConfiguredLlmProviders";

export function ContentPhaseClient({
  projectId,
  initialComposition,
  initialLocks,
  initialArticleText = "",
}: {
  projectId: string;
  initialComposition: CourseComposition;
  initialLocks: PhaseLocks;
  initialArticleText?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const { providers, labels, defaultProvider } = useConfiguredLlmProviders();
  const [composition, setComposition] = useState(initialComposition);
  const [locks, setLocks] = useState(initialLocks);
  const locked = locks.content;
  const [articleText, setArticleText] = useState(initialArticleText);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    initialComposition.steps[0]?.id ?? null,
  );
  const [llmProvider, setLlmProvider] = useState<LlmProviderId>("openrouter");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [articlePrompt, setArticlePrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultProvider) setLlmProvider(defaultProvider);
  }, [defaultProvider]);

  const selectedStep = composition.steps.find((s) => s.id === selectedStepId);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/composition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "content", composition }),
      });
      if (!res.ok) {
        toast((await res.json()).error ?? "儲存失敗", "error");
        return;
      }
      toast("文稿已儲存", "success");
    } finally {
      setSaving(false);
    }
  }, [projectId, composition, toast]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/projects/${projectId}/parse-document`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "檔案剖析失敗", "error");
        return;
      }
      setArticleText(data.text ?? "");
      toast(`已剖析「${file.name}」（${data.length} 字）`, "success");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generateArticle = async () => {
    if (!providers.length) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (!articlePrompt.trim()) {
      toast("請輸入生成提示詞", "error");
      return;
    }
    setGeneratingArticle(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: llmProvider, prompt: articlePrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "生成教學內容失敗", "error");
        return;
      }
      setArticleText(data.text ?? "");
      toast(`教學內容已生成（${data.length ?? 0} 字）`, "success");
    } finally {
      setGeneratingArticle(false);
    }
  };

  const generate = async () => {
    if (!providers.length) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (!articleText.trim()) {
      toast("請先在文字框貼上內容，或選擇檔案匯入", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: llmProvider, articleText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "AI 產生失敗", "error");
        return;
      }
      const proj = await fetch(`/api/projects/${projectId}`).then((r) => r.json());
      setComposition(proj.composition);
      toast(`AI 產生完成：${data.stepCount} 個步驟`, "success");
    } finally {
      setGenerating(false);
    }
  };

  const unlockPhase = async () => {
    const res = await fetch(`/api/projects/${projectId}/phases/content/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    const data = await res.json();
    setLocks(data.phase_locks);
    router.refresh();
    toast("已解除鎖定", "info");
  };

  return (
    <div className="space-y-6">
      <ProjectPhaseNav
        projectId={projectId}
        current="content"
        locks={locks}
        onLocksChange={setLocks}
        onBeforeLock={save}
      />
      {!locked ? (
        <section className="cf-card cf-card-padded space-y-6">
          <div>
            <h2 className="cf-section-title">生成教學內容</h2>
            <p className="mt-1 text-sm text-zinc-500">
              輸入提示詞，由 AI 撰寫教材原文；完成後會自動填入下方「匯入教學文件」文字框。
            </p>
            <textarea
              value={articlePrompt}
              onChange={(e) => setArticlePrompt(e.target.value)}
              rows={4}
              placeholder={`例如：幫我生成大約2000字以內的「AI Agent與Harness Engineering」的課程教材：\n教材名稱：AI Agent 與 Harness Engineering 入門\n大綱：一、什麼是 AI Agent？ 二、什麼是 Harness Engineering？ 三、如何做 Harness Engineering？`}
              className="mt-3 w-full rounded border border-[var(--border)] bg-black/30 p-3 text-sm"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {providers.length > 0 ? (
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as LlmProviderId)}
                  className="cf-select w-auto"
                >
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {labels[p]}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={generateArticle}
                disabled={generatingArticle || !providers.length}
                className="cf-btn cf-btn-primary"
              >
                {generatingArticle ? "生成中…" : "生成教學內容"}
              </button>
            </div>
          </div>
          <div>
          <h2 className="cf-section-title">匯入教學文件</h2>
          <div className="mt-3 space-y-3">
            <textarea
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
              rows={8}
              placeholder="貼上 txt / md / html 文字，或選擇下方檔案自動剖析…"
              className="w-full rounded border border-[var(--border)] bg-black/30 p-3 text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.html,.docx,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="cf-btn cf-btn-secondary"
              >
                {uploading ? "剖析中…" : "選擇檔案"}
              </button>
              {selectedFileName ? (
                <span className="text-sm text-zinc-400">已選：{selectedFileName}</span>
              ) : (
                <span className="text-sm text-zinc-500">支援 txt、md、html、docx、pdf（選檔後自動剖析）</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating || !providers.length}
              className="cf-btn cf-btn-primary"
            >
              {generating ? "AI 產生中…" : "AI 產生大綱與口說稿"}
            </button>
          </div>
          </div>
        </section>
      ) : null}
      <div className="grid min-h-[420px] grid-cols-1 gap-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:items-stretch sm:gap-5">
        <aside
          className={
            locked
              ? "flex min-h-0 min-w-0 flex-col pointer-events-none opacity-60"
              : "flex min-h-0 min-w-0 flex-col"
          }
        >
          <h2 className="mb-1.5 shrink-0 text-sm font-medium text-zinc-300">樹狀大綱</h2>
          <OutlineEditor
            composition={composition}
            onChange={setComposition}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            onError={(message) => toast(message, "error")}
            fillHeight
          />
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col">
          <h2 className="mb-1.5 shrink-0 text-sm font-medium text-zinc-300">步驟編輯</h2>
          {selectedStep ? (
            <div className="cf-card cf-card-padded flex min-h-0 flex-1 flex-col gap-2.5 text-sm">
              {selectedStep.stepKind === "chapter" ? (
                <p className="shrink-0 rounded border border-amber-600/40 bg-amber-950/30 px-2.5 py-2 text-xs text-amber-200/90">
                  此為「章節分隔頁」，標題與左側章節名稱同步；會出現在播放與匯出影片中，作為章節之間的過場畫面。
                </p>
              ) : null}
              <label className="block shrink-0 text-[11px] text-zinc-500">螢幕內容</label>
              <textarea
                disabled={locked || selectedStep.stepKind === "chapter"}
                value={selectedStep.screenContent}
                onChange={(e) =>
                  setComposition({
                    ...composition,
                    steps: composition.steps.map((s) =>
                      s.id === selectedStep.id
                        ? { ...s, screenContent: e.target.value }
                        : s,
                    ),
                  })
                }
                className="min-h-0 flex-1 resize-none rounded border border-[var(--border)] bg-black/30 p-2.5 text-sm leading-relaxed"
              />
              <label className="block shrink-0 text-[11px] text-zinc-500">口說稿</label>
              <textarea
                disabled={locked || selectedStep.stepKind === "chapter"}
                value={selectedStep.script}
                onChange={(e) =>
                  setComposition({
                    ...composition,
                    steps: composition.steps.map((s) =>
                      s.id === selectedStep.id ? { ...s, script: e.target.value } : s,
                    ),
                  })
                }
                className="min-h-0 flex-1 resize-none rounded border border-[var(--border)] bg-black/30 p-2.5 text-sm leading-relaxed"
              />
            </div>
          ) : (
            <div className="cf-card cf-card-padded flex min-h-0 flex-1 items-center justify-center">
              <p className="text-sm text-zinc-500">請從左側大綱選擇一個步驟</p>
            </div>
          )}
        </section>
      </div>
      <PhaseBottomActions
        projectId={projectId}
        phase="content"
        locks={locks}
        saving={saving}
        onSave={!locked ? save : undefined}
        onUnlock={unlockPhase}
      />
    </div>
  );
}
