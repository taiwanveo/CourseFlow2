"use client";

import { useState, useRef, useCallback } from "react";
import type { ChapterIllustrationEntry } from "@/lib/wvp-craft-illustrations";

interface Props {
  projectId: string;
  wvpChapterId: string;
  chapterTitle: string;
  disabled?: boolean;
  onOpenStylePicker?: () => void;
}

const BASE = (projectId: string, wvpChapterId: string) =>
  `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}`;

export function CraftChapterIllustration({
  projectId,
  wvpChapterId,
  chapterTitle,
  disabled = false,
  onOpenStylePicker,
}: Props) {
  const [entry, setEntry] = useState<ChapterIllustrationEntry | null>(null);
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
      const json = (await res.json()) as { chapterIllustration?: ChapterIllustrationEntry; error?: string };
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      const e = json.chapterIllustration ?? { visualMode: "animation" as const, status: "idle" as const };
      setEntry(e);
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

  // 首次掛載時載入
  const [mounted, setMounted] = useState(false);
  if (!mounted) {
    setMounted(true);
    void load();
  }

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
    if (disabled) return;
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
    if (disabled) return;
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

      {/* ── 動畫模式（預設） ── */}
      {isAnimation && (
        <div className="space-y-2">
          <p className="text-zinc-400">目前使用「步驟步進動畫（預設）」，無固定配圖。</p>
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
      {isAiImage && (
        <div className="space-y-2.5">
          <p className="text-zinc-400">
            AI 生圖模式：本章所有步驟將顯示同一張固定圖片背景。
          </p>

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
      {isUpload && (
        <div className="space-y-2.5">
          <p className="text-zinc-400">
            上傳圖片模式：本章所有步驟將顯示同一張固定圖片背景。
          </p>

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
    </div>
  );
}
