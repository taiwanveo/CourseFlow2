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
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | null>(null);
  const [lastEditedField, setLastEditedField] = useState<"screen" | "narration" | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const [wvpSettings, setWvpSettings] = useState<WvpSettings>(initialWvpSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chapterWvpIds = useMemo(() => wvpChapterIdMap(composition), [composition]);

  useEffect(() => {
    if (defaultProvider) setLlmProvider(defaultProvider);
  }, [defaultProvider]);

  const selectedStep = composition.steps.find((s) => s.id === selectedStepId);
  const selectedChapter = selectedStep
    ? composition.chapters.find((c) => c.id === selectedStep.chapterId) ?? null
    : null;

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
      // 自動儲存不彈通知，狀態顯示在面板標題旁
    } finally {
      setSaving(false);
    }
  }, [projectId, composition, wvpSettings, initialThemeId, toast]);

  // 用 ref 保存最新的 save，避免 auto-save effect 拿到舊 closure
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  // 自動儲存：composition 變動後 1.5 秒觸發
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (locked) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus("saving");
    autoSaveTimer.current = setTimeout(() => {
      saveRef.current().then(() => {
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus(null), 2000);
      });
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [composition, locked]);

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

  const generate = async () => {
    if (!providers.length) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (!articleText.trim()) {
      toast("請輸入提示詞或貼上教學文稿", "error");
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
      // 若為提示詞模式，伺服器回傳 AI 自動展開的教學文稿，填回 textarea 供使用者檢視
      if (data.generatedArticle) {
        setArticleText(data.generatedArticle);
      }
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
        <section className="cf-card cf-card-padded space-y-4">
          <div>
            <h2 className="cf-section-title">生成大綱與口播稿</h2>
            <p className="mt-1 text-sm text-zinc-500">
              輸入提示詞、貼上教學文稿，或上傳檔案，AI 將一次生成結構大綱、螢幕文字與口播稿。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-zinc-400">AI 提供者：</span>
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
          </div>
          <div className="space-y-3">
            <textarea
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
              rows={8}
              placeholder={`兩種用法皆可：\n\n① 提示詞（短指令，< 300 字）\n   例：幫我生成「Vibe Coding 入門」課程，包含：什麼是 Vibe Coding、核心優勢、適合對象\n   → AI 自動產生具 Markdown 階層的教學文稿，再轉成大綱與口播稿\n\n② 教學文稿（建議使用 Markdown 格式，解析效果最佳）\n   # 課程標題\n   ## 前言\n   （前言段落內容…）\n   ## 章節一\n   （內容段落…）\n   ## 結語\n   （收尾段落…）\n   → AI 依標題階層切分章節與步驟，口播稿完整保留每段內容\n\n也可點「上傳檔案」自動剖析 docx / pdf（建議原始文件本身有標題結構）。`}
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
                  "上傳檔案"
                )}
              </button>
              {selectedFileName ? (
                <span className="text-sm text-zinc-400">已選：{selectedFileName}</span>
              ) : (
                <span className="text-sm text-zinc-500">支援 txt、md、html、docx、pdf（選擇檔案上傳後將自動剖析）</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating || !providers.length}
              className="cf-btn cf-btn-primary"
            >
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  <LottieMark variant="loading" size={16} ariaLabel="生成中" />
                  <span>生成中…</span>
                </span>
              ) : (
                "生成大綱與口播稿"
              )}
            </button>
          </div>
        </section>
      ) : null}
      <div className="grid min-h-[420px] grid-cols-1 gap-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:items-start sm:gap-5">
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
          />
        </aside>
        <section className="sticky top-4 flex min-w-0 flex-col">
          <div className="mb-1.5 flex shrink-0 items-baseline gap-2">
            <h2 className="text-sm font-medium text-zinc-300">步驟編輯</h2>
          </div>
          {selectedStep ? (
            <div className="cf-card cf-card-padded flex flex-col gap-2.5 text-sm">
              {selectedStep.stepKind === "chapter" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <p className="w-fit rounded border border-amber-600/40 bg-amber-950/30 px-1.5 py-0.5 text-[8px] text-amber-200/90">章節分隔頁</p>
                  <span className="text-[10px] text-zinc-500">版面樣式</span>
                  <select
                    disabled={locked}
                    value={selectedChapter?.chapterKind ?? ""}
                    onChange={(e) => {
                      const kind = e.target.value as import("@courseflow/core").WvpChapterKind | "";
                      setComposition({
                        ...composition,
                        chapters: composition.chapters.map((c) =>
                          c.id === selectedChapter?.id
                            ? { ...c, chapterKind: kind || undefined }
                            : c,
                        ),
                      });
                    }}
                    className="cf-select w-[16.67%] py-0 text-[11px]"
                  >
                    <option value="">自動</option>
                    <option value="magazine">雜誌</option>
                    <option value="list-reveal">清單</option>
                    <option value="flow">流程</option>
                    <option value="hook">多圖</option>
                  </select>
                </div>
              ) : null}
              <div className="flex shrink-0 items-center gap-1.5">
                <label className="text-[11px] text-zinc-500">螢幕內容</label>
                {lastEditedField === "screen" && saveStatus && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    saveStatus === "saving"
                      ? "bg-orange-700/80 text-orange-100"
                      : "bg-emerald-700/80 text-emerald-100"
                  }`}>{saveStatus === "saving" ? "儲存中" : "已儲存"}</span>
                )}
              </div>
              <textarea
                disabled={locked}
                value={selectedStep.screenContent}
                onChange={(e) => {
                  setLastEditedField("screen");
                  setComposition({
                    ...composition,
                    steps: composition.steps.map((s) =>
                      s.id === selectedStep.id
                        ? { ...s, screenContent: e.target.value }
                        : s,
                    ),
                  });
                }}
                rows={3}
                className="resize-y rounded border border-[var(--border)] bg-black/30 p-2.5 text-sm leading-relaxed"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <label className="text-[11px] text-zinc-500">口播稿</label>
                {lastEditedField === "narration" && saveStatus && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    saveStatus === "saving"
                      ? "bg-orange-700/80 text-orange-100"
                      : "bg-emerald-700/80 text-emerald-100"
                  }`}>{saveStatus === "saving" ? "儲存中" : "已儲存"}</span>
                )}
              </div>
              <textarea
                disabled={locked}
                value={selectedStep.script}
                onChange={(e) => {
                  setLastEditedField("narration");
                  setComposition({
                    ...composition,
                    steps: composition.steps.map((s) =>
                      s.id === selectedStep.id ? { ...s, script: e.target.value } : s,
                    ),
                  });
                }}
                rows={5}
                className="resize-y rounded border border-[var(--border)] bg-black/30 p-2.5 text-sm leading-relaxed"
              />
            </div>
          ) : (
            <div className="cf-card cf-card-padded flex items-center justify-center py-12">
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
        onSave={undefined}
        onUnlock={unlockPhase}
      />
    </div>
  );
}
