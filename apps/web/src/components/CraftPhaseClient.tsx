"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { canAccessWvpPhase, type WvpPhaseLocks } from "@courseflow/core";
import { WvpPhaseBottomActions, WvpPhaseNav } from "@/components/ProjectPhaseNav";
import { useToast } from "@/components/Toast";
import { playFinishedSound, playWarningSound } from "@/lib/ui-sounds";
import { useConfiguredLlmProviders } from "@/hooks/useConfiguredLlmProviders";
import { ImageStylePickerModal } from "@/components/ImageStylePickerModal";
import type { ImageStyleCatalogEntry } from "@/data/image-style-catalog";
import { catalogEntryToSelection } from "@/lib/image-style";
import type { WvpSettings } from "@/lib/wvp-settings";
import { SettingsNavLink } from "@/components/SettingsNavLink";

type CraftRow = {
  id: string;
  wvp_chapter_id: string;
  title: string;
  craft_status: string;
  step_count: number;
  sort_order: number;
  checklist_result?: {
    narrations?: string[];
    aiPlan?: unknown;
    chapterSource?: { source?: "llm" | "template" };
  };
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  generating: "產生中…",
  draft: "草稿",
  "checklist-fail": "自檢未過",
  "anchor-review": "待驗收錨點",
  approved: "已通過",
};

/** 避免 React Strict Mode 重掛載時重複自動 scaffold */
const autoScaffoldAttemptedForProject = new Set<string>();

function CraftWorkflowStep({
  step,
  title,
  hint,
  children,
  muted,
}: {
  step: number;
  title: string;
  hint: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 rounded-lg border px-3 py-3 ${
        muted ? "border-zinc-800/60 opacity-60" : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300"
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium text-zinc-200">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export function CraftPhaseClient({
  projectId,
  initialLocks,
  initialSettings,
  initialThemeId,
  initialChapters,
}: {
  projectId: string;
  initialLocks: WvpPhaseLocks;
  initialSettings: WvpSettings;
  initialThemeId: string | null;
  initialChapters: CraftRow[];
}) {
  const [locks, setLocks] = useState(initialLocks);
  const [settings, setSettings] = useState(initialSettings);
  const [chapters, setChapters] = useState(initialChapters);
  const [selectedWvpId, setSelectedWvpId] = useState<string | null>(
    initialChapters[0]?.wvp_chapter_id ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [wvpHydrated, setWvpHydrated] = useState(false);
  const [themes, setThemes] = useState<{ id: string; nameZh: string }[]>([]);
  const [savingTheme, setSavingTheme] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [savingImageStyle, setSavingImageStyle] = useState(false);
  const autoScaffoldAttempted = useRef(false);
  const { toast } = useToast();
  const { providers, defaultProvider } = useConfiguredLlmProviders();
  const craftAccessible = canAccessWvpPhase(locks, "craft");
  const selectedThemeId = (settings.themeId ?? initialThemeId ?? "").trim();
  const hasSelectedTheme = Boolean(selectedThemeId);
  const hasImageStyle = Boolean(settings.imageStyle?.id);
  const anchorTrialDone = Boolean(settings.anchorChapterTrialCompleted);
  const anchorOk = settings.anchorChapterApproved;
  const firstChapterWvpId = chapters[0]?.wvp_chapter_id ?? null;
  const canTrialChapter1 =
    hasSelectedTheme &&
    hasImageStyle &&
    chapters.length > 0 &&
    !!firstChapterWvpId &&
    providers.length > 0 &&
    !locks.craft;

  useEffect(() => {
    fetch("/api/themes")
      .then((r) => r.json())
      .then((d) => setThemes(d.themes ?? []));
  }, []);

  const refreshWvp = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/wvp`);
    if (!res.ok) {
      setWvpHydrated(true);
      return;
    }
    const data = await res.json();
    setChapters(data.chapters ?? []);
    if (data.wvpSettings) setSettings(data.wvpSettings);
    setWvpHydrated(true);
  }, [projectId]);

  useEffect(() => {
    void refreshWvp();
  }, [refreshWvp]);

  const saveWvpSettings = useCallback(async () => {
    if (!selectedThemeId) {
      throw new Error("請先選擇簡報主題");
    }
    setSavingTheme(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wvpSettings: { ...settings, devMode: "sequential" as const },
          themeId: selectedThemeId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "儲存失敗");
    } finally {
      setSavingTheme(false);
    }
  }, [projectId, settings, selectedThemeId]);

  const scaffold = useCallback(
    async (opts?: { auto?: boolean }) => {
      setBusy("scaffold");
      try {
        const res = await fetch(`/api/projects/${projectId}/wvp/scaffold`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "建立失敗");
        const nextChapters = data.chapters ?? [];
        setChapters(nextChapters);
        if (nextChapters[0]?.wvp_chapter_id) {
          setSelectedWvpId(nextChapters[0].wvp_chapter_id);
        }
        toast(
          opts?.auto
            ? `已自動建立 ${data.chapterCount} 個章節`
            : `已建立 ${data.chapterCount} 個章節`,
          "success",
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : "建立失敗", "error");
        if (opts?.auto) {
          autoScaffoldAttempted.current = false;
          autoScaffoldAttemptedForProject.delete(projectId);
        }
      } finally {
        setBusy(null);
      }
    },
    [projectId, toast],
  );

  useEffect(() => {
    if (!wvpHydrated) return;
    if (autoScaffoldAttempted.current || autoScaffoldAttemptedForProject.has(projectId)) return;
    if (!craftAccessible || locks.craft || chapters.length > 0) return;

    autoScaffoldAttempted.current = true;
    autoScaffoldAttemptedForProject.add(projectId);
    void scaffold({ auto: true });
  }, [wvpHydrated, craftAccessible, locks.craft, chapters.length, projectId, scaffold]);

  const syncChapter = async (wvpChapterId: string) => {
    setBusy(`sync-${wvpChapterId}`);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/sync`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "匯入失敗");
      await refreshWvp();
      toast("已從文稿匯入本章口播與步數", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "匯入失敗", "error");
    } finally {
      setBusy(null);
    }
  };

  const selectImageStyle = async (entry: ImageStyleCatalogEntry) => {
    const next: WvpSettings = {
      ...settings,
      imageStyle: catalogEntryToSelection(entry),
    };
    setSettings(next);
    setSavingImageStyle(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wvpSettings: { ...next, devMode: "sequential" as const },
          themeId: next.themeId ?? initialThemeId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "儲存失敗");
      toast(`已選擇生圖風格：${entry.titleZh}`, "success");
      setStylePickerOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "儲存風格失敗", "error");
    } finally {
      setSavingImageStyle(false);
    }
  };

  const batchCraftAll = async (onlyMissing: boolean) => {
    if (!defaultProvider) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (!hasImageStyle) {
      toast("請先選擇生圖風格主題", "error");
      setStylePickerOpen(true);
      return;
    }
    if (chapters.length === 0) {
      toast("請先建立章節清單", "error");
      return;
    }
    setBusy("batch-craft");
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp/batch-craft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: defaultProvider, onlyMissing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "批次處理失敗");
      await refreshWvp();
      const s = data.summary as {
        total?: number;
        synced?: number;
        generated?: number;
        failed?: number;
      };
      if (s.failed && s.failed > 0) {
        playWarningSound();
        toast(
          `已完成 ${s.generated ?? 0}/${s.total ?? 0} 章 AI 產生；${s.failed} 章有錯誤（見主控台或重試單章）`,
          "info",
        );
      } else {
        toast(
          `已處理 ${s.total ?? chapters.length} 章：匯入口播 ${s.synced ?? 0}、產生畫面 ${s.generated ?? 0}。請前往「3. 語音生成」，再到「4. 預覽匯出」打包。`,
          "success",
          { taskComplete: true },
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "批次處理失敗", "error");
    } finally {
      setBusy(null);
    }
  };

  const generateChapter = async (wvpChapterId: string) => {
    if (!defaultProvider) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (!hasImageStyle) {
      toast("請先選擇生圖風格主題", "error");
      setStylePickerOpen(true);
      return;
    }
    setBusy(`gen-${wvpChapterId}`);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: defaultProvider }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI 產生失敗");
      await refreshWvp();
      const src =
        data.chapterSource === "llm"
          ? "（AI 依文稿客製視覺）"
          : "（文稿對齊模板，含內容化動效）";
      toast(`本章畫面程式已產生${src}`, "success", { taskComplete: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI 產生失敗", "error");
    } finally {
      setBusy(null);
    }
  };

  const trialChapter1 = async () => {
    if (!defaultProvider) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (!hasSelectedTheme) {
      toast("請先選擇並儲存簡報主題", "error");
      return;
    }
    if (!hasImageStyle) {
      toast("請先選擇生圖風格主題", "error");
      setStylePickerOpen(true);
      return;
    }
    setBusy("trial-ch1");
    try {
      await saveWvpSettings();
      const res = await fetch(`/api/projects/${projectId}/wvp/trial-chapter-1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: defaultProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "試執行失敗");
      setSettings((s) => ({ ...s, anchorChapterTrialCompleted: true }));
      await refreshWvp();
      const tpl =
        data.templateKind === "hook"
          ? "Hook 多圖"
          : data.templateKind === "flow"
            ? "流程動畫"
            : "清單揭示";
      if (data.illustrationSyncWarning) {
        toast(`第 1 章試執行完成（${tpl}）。${data.illustrationSyncWarning}`, "info");
        playFinishedSound();
      } else {
        toast(`第 1 章試執行完成（自動套用 ${tpl} 模板）`, "success", {
          taskComplete: true,
        });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "試執行失敗", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <WvpPhaseNav
        projectId={projectId}
        current="craft"
        locks={locks}
        onLocksChange={setLocks}
        onBeforeLock={saveWvpSettings}
      />

      {!craftAccessible ? (
        <div
          className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200/90"
          role="status"
        >
          尚無法編輯視覺動效：請先在「1. 文稿內容」完成大綱與口播並按「鎖定」。
          <Link
            href={`/projects/${projectId}/content`}
            className="ml-2 underline hover:text-amber-100"
          >
            前往文稿內容
          </Link>
        </div>
      ) : null}

      {locks.craft ? (
        <div
          className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300"
          role="status"
        >
          本階段已鎖定，無法建立清單或產生畫面。請在按「解除鎖定」後再操作。
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-2xl">
        <aside className="cf-card cf-card-padded space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">簡報主題</h3>
            <label className="block text-[11px] text-zinc-500">
              決定整體視覺風格。
              <select
                className="cf-select mt-1 w-full text-sm"
                disabled={locks.craft}
                value={selectedThemeId}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, themeId: e.target.value || null }))
                }
              >
                <option value="">選擇主題</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameZh}
                  </option>
                ))}
              </select>
            </label>
            {!hasSelectedTheme ? (
              <p className="text-[11px] text-amber-500/90">請先選擇簡報主題，才能儲存</p>
            ) : null}
            {!locks.craft ? (
              <button
                type="button"
                className="cf-btn cf-btn-secondary cf-btn-sm w-full"
                disabled={savingTheme || !hasSelectedTheme}
                onClick={async () => {
                  try {
                    await saveWvpSettings();
                    toast("主題已儲存", "success");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "儲存主題失敗", "error");
                  }
                }}
              >
                {savingTheme ? "儲存中…" : "儲存主題"}
              </button>
            ) : null}
          </div>

          <div className="space-y-4 border-t border-zinc-800 pt-4">
            <div>
              <h2 className="cf-section-title">視覺動效 — 操作步驟</h2>
              <p className="mt-1 text-sm text-zinc-500">
                把文稿變成可點擊推進的 16:9 網頁畫面（本階段只做視覺與口播結構）。完成後請到「3. 語音生成」合成 TTS，再到「4. 預覽匯出」打包與預覽。
              </p>
            </div>

            <div className="space-y-2">
              <CraftWorkflowStep
                step={1}
                title="建立章節清單"
                hint="首次進入本階段時會依文稿章節自動建立清單；若失敗或需重建，可手動重試。"
              >
                <button
                  type="button"
                  className="cf-btn cf-btn-primary cf-btn-sm"
                  disabled={!!busy || locks.craft}
                  onClick={() => scaffold()}
                >
                  {busy === "scaffold" ? "建立中…" : chapters.length > 0 ? "重建章節清單" : "建立章節清單"}
                </button>
              </CraftWorkflowStep>

              <CraftWorkflowStep
                step={2}
                title="一鍵從「文稿內容」匯入口播稿，並使用AI產生章節畫面程式"
                hint="請先選擇生圖風格主題（影響後續建置時的 AI 教學配圖）。按下「開始執行」可替全部章節匯入口播並產生章節畫面程式。"
              >
                <div className="w-full space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="cf-btn cf-btn-secondary cf-btn-sm"
                      disabled={!!busy || locks.craft || savingImageStyle}
                      onClick={() => setStylePickerOpen(true)}
                    >
                      {savingImageStyle ? "儲存中…" : "選擇生圖風格主題"}
                    </button>
                    {hasImageStyle ? (
                      <span className="text-xs text-emerald-400/90">
                        已選：{settings.imageStyle?.titleZh}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500/90">尚未選擇（必選）</span>
                    )}
                  </div>
                  {hasImageStyle ? (
                    <p className="text-[11px] leading-snug text-zinc-600">
                      已採用 BananaX 官網中文提示詞。若更換風格，請在「4. 預覽匯出」重新建置後，AI 配圖才會更新。
                    </p>
                  ) : null}
                </div>
                {!anchorOk ? (
                  <div className="mb-3 w-full space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
                    <p className="text-sm font-medium text-emerald-100/90">
                      請先驗收第 1 章風格，確認無誤後才能執行全課「開始執行」。
                    </p>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      系統會依 Checkpoint 素材自動選擇 Hook 或清單揭示模板，無需手動逐一套用。
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="cf-btn cf-btn-primary cf-btn-sm"
                        disabled={!!busy || !canTrialChapter1 || anchorTrialDone}
                        onClick={() => void trialChapter1()}
                      >
                        {busy === "trial-ch1" ? "試執行中…" : "試執行第 1 章"}
                      </button>
                      {anchorTrialDone ? (
                        <Link
                          href={`/projects/${projectId}/wvp-play?anchor=1&start=1`}
                          className="cf-btn cf-btn-secondary cf-btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          預覽第 1 章
                        </Link>
                      ) : null}
                    </div>
                    {anchorTrialDone && !anchorOk ? (
                      <p className="text-[11px] text-amber-500/90">
                        請在預覽畫面底部按「已確認第 1 章風格」。
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="cf-btn cf-btn-primary cf-btn-sm"
                  disabled={
                    !!busy ||
                    locks.craft ||
                    chapters.length === 0 ||
                    !providers.length ||
                    !anchorOk ||
                    !anchorTrialDone ||
                    !hasImageStyle ||
                    !hasSelectedTheme
                  }
                  onClick={() => batchCraftAll(false)}
                >
                  {busy === "batch-craft" ? "處理中…" : "開始執行"}
                </button>
                <button
                  type="button"
                  className="cf-btn cf-btn-secondary cf-btn-sm"
                  disabled={
                    !!busy ||
                    chapters.length === 0 ||
                    !providers.length ||
                    !hasImageStyle ||
                    !anchorOk ||
                    !anchorTrialDone
                  }
                  onClick={() => batchCraftAll(true)}
                  title="只對尚未產生畫面的章節執行 AI"
                >
                  僅補未完成
                </button>
              </CraftWorkflowStep>

            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">章節列表</h3>
              {chapters.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-zinc-500">每章可單獨匯入口播或產生畫面</p>
              ) : null}
            </div>
          {!providers.length && chapters.length > 0 ? (
            <p className="text-[11px] text-amber-500/90">
              AI 產生畫面需先{" "}
              <SettingsNavLink className="underline hover:text-amber-400">設定 API Key</SettingsNavLink>
            </p>
          ) : null}
          {chapters.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {busy === "scaffold" ? "正在建立章節清單…" : "首次進入會自動建立；若未完成請在上方重試"}
            </p>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch, i) => {
                const isSelected = selectedWvpId === ch.wvp_chapter_id;
                const isSyncing = busy === `sync-${ch.wvp_chapter_id}`;
                const isGenerating = busy === `gen-${ch.wvp_chapter_id}`;

                return (
                  <div
                    key={ch.id}
                    className={`flex items-start gap-1.5 rounded border px-2 py-1.5 ${
                      isSelected
                        ? "border-[var(--accent)] bg-zinc-900"
                        : "border-[var(--border)] bg-zinc-950/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedWvpId(ch.wvp_chapter_id)}
                      className="min-w-0 flex-1 text-left hover:opacity-90"
                    >
                      <span className="line-clamp-2 text-sm font-medium leading-snug">{ch.title}</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">
                        {STATUS_LABEL[ch.craft_status] ?? ch.craft_status}
                        {ch.step_count > 0 ? ` · ${ch.step_count} 步` : ""}
                        {(ch.checklist_result?.narrations?.length ?? 0) > 0 ? " · 已匯入" : ""}
                        {ch.checklist_result?.chapterSource ? " · 有畫面" : ""}
                        {i === 0 ? " · 第 1 章" : ""}
                      </span>
                    </button>
                    {!locks.craft ? (
                      <>
                        <button
                          type="button"
                          title="從文稿匯入口播"
                          className="cf-btn cf-btn-secondary shrink-0 basis-1/4 px-1 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy}
                          onClick={() => syncChapter(ch.wvp_chapter_id)}
                        >
                          {isSyncing ? "…" : "匯入口播"}
                        </button>
                        <button
                          type="button"
                          title="AI 產生章節畫面程式"
                          className="cf-btn cf-btn-secondary shrink-0 basis-1/4 px-1 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy || !providers.length || !hasImageStyle}
                          onClick={() => generateChapter(ch.wvp_chapter_id)}
                        >
                          {isGenerating ? "…" : "AI 畫面"}
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </aside>
      </div>

      <ImageStylePickerModal
        open={stylePickerOpen}
        selectedId={settings.imageStyle?.id}
        disabled={locks.craft || savingImageStyle}
        onClose={() => setStylePickerOpen(false)}
        onSelect={(entry) => void selectImageStyle(entry)}
      />

      <WvpPhaseBottomActions
        projectId={projectId}
        phase="craft"
        locks={locks}
        onUnlock={async () => {
          const res = await fetch(`/api/projects/${projectId}/wvp/phases/craft/lock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "unlock" }),
          });
          const data = await res.json();
          if (res.ok) setLocks(data.wvp_phase_locks);
        }}
      />
    </div>
  );
}
