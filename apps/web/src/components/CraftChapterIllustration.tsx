"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChapterIllustrationEntry } from "@/lib/wvp-craft-illustrations";
import type { ChapterScriptStep } from "@/lib/chapter-script-reference";

interface Props {
  projectId: string;
  wvpChapterId: string;
  chapterTitle: string;
  scriptSteps?: ChapterScriptStep[];
  disabled?: boolean;
  reloadKey?: number;
  onOpenStylePicker?: () => void;
  onOpenStepStudio?: () => void;
}

function ChapterScriptReference({ steps }: { steps: ChapterScriptStep[] }) {
  const hasContent = steps.some((s) => s.screen || s.script);
  if (!hasContent) {
    return (
      <p className="text-[11px] text-zinc-500">尚無文稿內容，請先在「1. 文稿」階段填寫。</p>
    );
  }
  return (
    <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-zinc-700/80 bg-zinc-950/60 p-2">
      <p className="text-[10px] font-medium text-zinc-500">本章文稿參考（生圖／上傳時請對照）</p>
      {steps.map((step) => (
        <div key={step.label} className="space-y-0.5 border-t border-zinc-800 pt-1.5 first:border-0 first:pt-0">
          <span className="text-[10px] text-zinc-500">{step.label}</span>
          {step.screen ? (
            <p className="text-[11px] leading-snug text-zinc-300">
              <span className="text-zinc-500">螢幕：</span>
              {step.screen}
            </p>
          ) : null}
          {step.script ? (
            <p className="text-[11px] leading-snug text-zinc-400">
              <span className="text-zinc-500">口播：</span>
              {step.script}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const BASE = (projectId: string, wvpChapterId: string) =>
  `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}`;

export function CraftChapterIllustration({
  projectId,
  wvpChapterId,
  chapterTitle,
  scriptSteps = [],
  disabled = false,
  reloadKey = 0,
  onOpenStylePicker,
  onOpenStepStudio,
}: Props) {
  const [entry, setEntry] = useState<ChapterIllustrationEntry | null>(null);
  const [stepAnimationActive, setStepAnimationActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 初始載入 ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${BASE(projectId, wvpChapterId)}/illustrations`);
      const json = (await res.json()) as {
        chapterIllustration?: ChapterIllustrationEntry;
        stepAnimationActive?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      const e = json.chapterIllustration ?? { visualMode: "animation" as const, status: "idle" as const };
      setEntry(e);
      setStepAnimationActive(Boolean(json.stepAnimationActive));
      if (e.imageWritten) {
        setImageUrl(
          `${BASE(projectId, wvpChapterId)}/illustration/image?t=${Date.now()}`,
        );
      }
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, wvpChapterId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  // ── API 呼叫 helpers ─────────────────────────────────────────
  async function patch(body: object) {
    const res = await fetch(`${BASE(projectId, wvpChapterId)}/illustrations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { chapterIllustration?: ChapterIllustrationEntry; error?: string };
    if (!res.ok) throw new Error(json.error ?? "更新失敗");
    return json.chapterIllustration!;
  }

  async function planPrompt() {
    const res = await fetch(`${BASE(projectId, wvpChapterId)}/illustrations/plan`, {
      method: "POST",
    });
    const json = (await res.json()) as { chapterIllustration?: ChapterIllustrationEntry; error?: string };
    if (!res.ok) throw new Error(json.error ?? "產生提示詞失敗");
    return json.chapterIllustration!;
  }

  async function generateImage() {
    const res = await fetch(`${BASE(projectId, wvpChapterId)}/illustrations/generate`, {
      method: "POST",
    });
    const json = (await res.json()) as { chapterIllustration?: ChapterIllustrationEntry; error?: string };
    if (!res.ok) throw new Error(json.error ?? "生圖失敗");
    return json.chapterIllustration!;
  }

  // ── 按鈕動作 ──────────────────────────────────────────────────
  async function handleSwitchToAi() {
    if (disabled || stepAnimationActive) return;
    setLoading(true);
    try {
      const e = await patch({ visualMode: "ai-image" });
      setEntry(e);
      setImageUrl(null); // 切模式時清除舊圖預覽
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchToAnimation() {
    if (disabled) return;
    setLoading(true);
    try {
      const e = await patch({ visualMode: "animation" });
      setEntry(e);
      setImageUrl(null);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanPrompt() {
    if (disabled) return;
    setLoading(true);
    setLoadError(null);
    try {
      const e = await planPrompt();
      setEntry(e);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAndGenerate() {
    if (disabled) return;
    setLoading(true);
    setLoadError(null);
    try {
      // 先確認提示詞
      const confirmed = await patch({ confirm: true });
      setEntry(confirmed);
      // 再生圖
      const done = await generateImage();
      setEntry(done);
      if (done.imageWritten) {
        setImageUrl(`${BASE(projectId, wvpChapterId)}/illustration/image?t=${Date.now()}`);
      }
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadFile(file: File) {
    if (disabled || stepAnimationActive) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `${BASE(projectId, wvpChapterId)}/illustration/image`,
        { method: "POST", body: formData },
      );
      const json = (await res.json()) as { chapterIllustration?: ChapterIllustrationEntry; error?: string };
      if (!res.ok) throw new Error(json.error ?? "上傳失敗");
      setEntry(json.chapterIllustration!);
      setImageUrl(`${BASE(projectId, wvpChapterId)}/illustration/image?t=${Date.now()}`);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePromptChange(value: string) {
    setEntry((prev) => prev ? { ...prev, promptForApi: value } : prev);
  }

  async function handleSavePrompt() {
    if (disabled || !entry?.promptForApi) return;
    setLoading(true);
    try {
      const e = await patch({ promptForApi: entry.promptForApi });
      setEntry(e);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── 渲染 ──────────────────────────────────────────────────────
  if (!entry && loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-500">
        載入中…
      </div>
    );
  }

  const mode = entry?.visualMode ?? "animation";
  const isGenerating = entry?.status === "generating";
  const isAnimation = mode === "animation";
  const isAiImage = mode === "ai-image";
  const isUpload = mode === "upload";
  const hasImage = !!imageUrl && entry?.imageWritten;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-300 truncate max-w-[70%]">{chapterTitle}</span>
        <span className="text-zinc-500 text-[11px]">章節配圖</span>
      </div>

      {loadError && (
        <p className="rounded bg-red-950/50 border border-red-700/40 px-2 py-1.5 text-red-300">
          {loadError}
        </p>
      )}

      {stepAnimationActive ? (
        <p className="rounded border border-amber-800/50 bg-amber-950/30 px-2 py-1.5 text-amber-200/90">
          本章已有步驟解說動畫，整章 AI 生圖／上傳圖片已停用。請點「步驟配圖」管理各步驟。
        </p>
      ) : null}

      {/* ── 動畫模式（預設） ── */}
      {isAnimation && !stepAnimationActive && (
        <div className="space-y-2">
          <p className="text-zinc-400">目前使用「步驟步進動畫（預設）」，無固定配圖。</p>
          <ChapterScriptReference steps={scriptSteps} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => void handleSwitchToAi()}
              className="rounded bg-violet-800 px-2.5 py-1 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              AI 生圖
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-zinc-700 px-2.5 py-1 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
            >
              上傳圖片
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/bmp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* ── AI 生圖模式 ── */}
      {isAiImage && !stepAnimationActive && (
        <div className="space-y-2.5">
          <p className="text-zinc-400">
            AI 生圖模式：本章所有步驟將顯示同一張固定圖片背景。
          </p>
          <ChapterScriptReference steps={scriptSteps} />

          {/* 提示詞區 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-zinc-500">生圖提示詞</label>
              <button
                type="button"
                disabled={disabled || loading || isGenerating}
                onClick={() => void handlePlanPrompt()}
                className="text-[11px] text-violet-400 hover:text-violet-300 disabled:opacity-50"
              >
                AI 產生提示詞
              </button>
            </div>
            <textarea
              rows={4}
              value={entry?.promptForApi ?? ""}
              onChange={(e) => void handlePromptChange(e.target.value)}
              placeholder="輸入提示詞，或點「AI 產生提示詞」自動填入"
              disabled={disabled || loading || isGenerating}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50 focus:outline-none"
            />
            {entry?.promptForApi && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => void handleSavePrompt()}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
              >
                儲存提示詞
              </button>
            )}
          </div>

          {/* 圖片預覽 */}
          {hasImage && imageUrl && (
            <img
              src={imageUrl}
              alt="章節配圖預覽"
              className="max-h-48 w-auto max-w-full block mx-auto rounded border border-zinc-700"
            />
          )}
          {entry?.error && (
            <p className="text-[11px] text-red-400">{entry.error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {entry?.promptForApi?.trim() && (
              <button
                type="button"
                disabled={disabled || loading || isGenerating}
                onClick={() => void handleConfirmAndGenerate()}
                className="rounded bg-violet-800 px-2.5 py-1 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isGenerating ? "生圖中…" : hasImage ? "重新生圖" : "確認並生圖"}
              </button>
            )}
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => void handleSwitchToAnimation()}
              className="rounded bg-zinc-700 px-2.5 py-1 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
            >
              還原預設
            </button>
          </div>
        </div>
      )}

      {/* ── 上傳圖片模式 ── */}
      {isUpload && !stepAnimationActive && (
        <div className="space-y-2.5">
          <p className="text-zinc-400">
            上傳圖片模式：本章所有步驟將顯示同一張固定圖片背景。
          </p>
          <ChapterScriptReference steps={scriptSteps} />

          {hasImage && imageUrl && (
            <img
              src={imageUrl}
              alt="章節配圖預覽"
              className="max-h-48 w-auto max-w-full block mx-auto rounded border border-zinc-700"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-zinc-700 px-2.5 py-1 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
            >
              {hasImage ? "重新上傳" : "選擇圖片"}
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => void handleSwitchToAnimation()}
              className="rounded bg-zinc-700 px-2.5 py-1 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
            >
              還原預設
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/bmp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {loading && !isGenerating && (
        <p className="text-[11px] text-zinc-500">處理中…</p>
      )}

      {onOpenStepStudio ? (
        <div className="border-t border-zinc-800 pt-3">
          <button
            type="button"
            className="cf-btn cf-btn-secondary cf-btn-sm w-full"
            disabled={disabled}
            onClick={onOpenStepStudio}
          >
            步驟配圖
          </button>
        </div>
      ) : null}
    </div>
  );
}
