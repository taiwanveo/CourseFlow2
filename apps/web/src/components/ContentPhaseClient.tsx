"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhaseBottomActions, ProjectPhaseNav } from "@/components/ProjectPhaseNav";
import { OutlineEditor } from "@/components/OutlineEditor";
import type { CourseComposition, WvpPhaseLocks } from "@courseflow/core";
import type { LlmProviderId } from "@courseflow/llm";
import { useToast } from "@/components/Toast";
import { LottieMark } from "@/components/lottie/LottieMark";
import { useConfiguredLlmProviders } from "@/hooks/useConfiguredLlmProviders";
import type { WvpSettings } from "@/lib/wvp-settings";
import { wvpChapterIdMap } from "@/lib/wvp-chapter-id-map";

export function ContentPhaseClient({
  projectId,
  initialComposition,
  initialLocks,
  initialArticleText = "",
  initialWvpSettings = {},
  initialThemeId = null,
}: {
  projectId: string;
  initialComposition: CourseComposition;
  initialLocks: WvpPhaseLocks;
  initialArticleText?: string;
  initialWvpSettings?: WvpSettings;
  initialThemeId?: string | null;
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
  const [wvpSettings, setWvpSettings] = useState<WvpSettings>(initialWvpSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chapterWvpIds = useMemo(() => wvpChapterIdMap(composition), [composition]);

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
      const wvpRes = await fetch(`/api/projects/${projectId}/wvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wvpSettings: {
            ...wvpSettings,
            devMode: "sequential",
            assets: wvpSettings.assets ?? [],
          },
          themeId: wvpSettings.themeId ?? initialThemeId,
        }),
      });
      if (!wvpRes.ok) {
        toast((await wvpRes.json()).error ?? "章節配圖儲存失敗", "error");
        return;
      }
      toast("文稿與章節配圖已儲存", "success");
    } finally {
      setSaving(false);
    }
  }, [projectId, composition, wvpSettings, initialThemeId, toast]);

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
      toast(`教學內容已生成（${data.length ?? 0} 字）`, "success", { taskComplete: true });
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
      toast(`AI 產生完成：${data.stepCount} 個步驟`, "success", { taskComplete: true });
    } finally {
      setGenerating(false);
    }
  };

  const unlockPhase = async () => {
    const res = await fetch(`/api/projects/${projectId}/wvp/phases/content/lock`, {
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
              請先在下方輸入提示詞，由AI生成教材內容，生成完畢後會自動填入「教學內容」。
            </p>
            選擇AI提供者：
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
            <h2 className="cf-section-title">提示詞：</h2>
            <div className="mt-3 space-y-3">
            <textarea
              value={articlePrompt}
              onChange={(e) => setArticlePrompt(e.target.value)}
              rows={4}
              placeholder={`例如：幫我生成大約2000字以內的「AI Agent與Harness Engineering」的課程教材：\n教材名稱：AI Agent 與 Harness Engineering 入門\n大綱：一、什麼是 AI Agent？ 二、什麼是 Harness Engineering？ 三、如何做 Harness Engineering？`}
              className="mt-3 w-full rounded border border-[var(--border)] bg-black/30 p-3 text-sm"
            />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <h2 className="cf-section-title">教學內容：</h2>
          <div className="mt-3 space-y-3">
            <textarea
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
              rows={8}
              placeholder="貼上 txt / md / html 文字，或上傳檔案自動剖析…"
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
                {uploading ? (
                  <span className="inline-flex items-center gap-2">
                    <LottieMark variant="loading" size={16} ariaLabel="剖析中" />
                    <span>剖析中…</span>
                  </span>
                ) : (
                  "選擇檔案"
                )}
              </button>
              {selectedFileName ? (
                <span className="text-sm text-zinc-400">已選：{selectedFileName}</span>
              ) : (
                <span className="text-sm text-zinc-500">支援 txt、md、html、docx、pdf（選擇檔案上傳後將自動剖析）</span>
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
              {generating ? "大綱與口播稿產生中…" : "產生大綱與口播稿"}
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
            projectId={projectId}
            chapterWvpIds={chapterWvpIds}
            assets={wvpSettings.assets ?? []}
            onAssetsChange={(assets) => setWvpSettings((s) => ({ ...s, assets }))}
            assetsLocked={locked}
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
              <label className="block shrink-0 text-[11px] text-zinc-500">口播稿</label>
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
