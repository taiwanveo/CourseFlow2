"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CompactBatchProgressPanel } from "@/components/CompactBatchProgressPanel";
import { useElapsedMs } from "@/hooks/useElapsedMs";
import { canAccessWvpPhase, type WvpPhaseLocks } from "@courseflow/core";
import { WvpPhaseBottomActions, WvpPhaseNav } from "@/components/ProjectPhaseNav";
import { useToast } from "@/components/Toast";
import { playFinishedSound, playWarningSound } from "@/lib/ui-sounds";
import { useConfiguredLlmProviders } from "@/hooks/useConfiguredLlmProviders";
import { ImageStylePickerModal } from "@/components/ImageStylePickerModal";
import type { ImageStyleCatalogEntry } from "@/data/image-style-catalog";
import { catalogEntryToSelection } from "@/lib/image-style";
import type { EnterMotionStyle, WvpAssetRef, WvpSettings } from "@/lib/wvp-settings";
import {
  CHAPTER_MOTION_ORIENTATION_LABELS,
  parseChapterMotionOrientation,
  type ChapterMotionOrientation,
} from "@courseflow/explain-animation";
import { ChapterOutlineImages } from "@/components/ChapterOutlineImages";
import { SettingsNavLink } from "@/components/SettingsNavLink";
import { CraftChapterIllustration } from "@/components/CraftChapterIllustration";
import { CraftStepIllustrationModal } from "@/components/CraftStepIllustrationModal";
import type { CourseComposition } from "@courseflow/core";
import { chapterScriptSteps, type ChapterScriptStep } from "@/lib/chapter-script-reference";
import {
  resolveCraftTemplateKind,
  templateKindDisplayLabel,
} from "@/lib/wvp-template-kind-label";
import type { WvpChapterKind } from "@courseflow/core";
import {
  CRAFT_TEMPLATE_OPTIONS,
  chapterEffectiveTemplateKind,
  resolveChapterTemplateSelectState,
} from "@/lib/wvp-chapter-template";
import {
  countHookChapterAssets,
  HOOK_OPENING_HINT,
  hookPreviewWarningMessage,
} from "@/lib/wvp-hook-ui";
import { BatchCraftProgressPanel } from "@/components/BatchCraftProgressPanel";
import {
  createInitialTrialProgress,
  estimateTrialOptimisticPhaseIndex,
  estimateTrialRemainingMs,
  parseWvpTrialProgress,
  toTrialCompactProgress,
  type WvpTrialChapterProgress,
} from "@/lib/wvp-trial-progress";
import {
  createInitialBatchProgress,
  type WvpBatchCraftProgress,
} from "@/lib/wvp-batch-craft-progress";
import {
  preloadAllThemeGalleryImages,
  preloadThemeGalleryImages,
  resolveThemeGalleryMeta,
  themeGalleryFallbackImage,
} from "@/data/theme-gallery";
import {
  isThemePreviewCached,
  markThemePreviewCached,
} from "@/lib/theme-preview-cache";

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
    chapterSource?: { source?: "llm" | "template"; templateKind?: string };
    appliedTemplate?: string;
    motionOrientation?: ChapterMotionOrientation;
  };
};

const MOTION_ORIENTATION_SHORT: Record<ChapterMotionOrientation, string> = {
  auto: "自動",
  data: "數據",
  flow: "流程",
  contrast: "對比",
  minimal: "極簡",
};

const MOTION_ORIENTATION_OPTIONS = (
  Object.keys(MOTION_ORIENTATION_SHORT) as ChapterMotionOrientation[]
).map((value) => ({
  value,
  label: MOTION_ORIENTATION_SHORT[value],
  title: CHAPTER_MOTION_ORIENTATION_LABELS[value],
}));

const ENTER_MOTION_STYLE_LABELS: Record<EnterMotionStyle, string> = {
  conservative: "保守（淡入為主）",
  standard: "標準",
  dramatic: "戲劇化（多變進場）",
};

type ThemeOption = {
  id: string;
  nameZh: string;
  descriptionZh?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  generating: "產生中…",
  draft: "草稿",
  "checklist-fail": "自檢未過",
  "anchor-review": "待驗收錨點",
  approved: "已通過",
};

type ResponsePayload = Record<string, unknown> & {
  error?: string;
  rawText?: string;
  illustrationSyncWarning?: string;
};

type BatchSummary = {
  total: number;
  synced: number;
  generated: number;
  failed: number;
};

/** 點擊當下先開分頁，避免 async 打包完成後 window.open 被瀏覽器擋下 */
function openChapterPreviewPlaceholderTab(chapterTitle: string): Window | null {
  const tab = window.open("", "_blank");
  if (!tab) return null;
  try {
    tab.document.title = "預覽打包中…";
    const main = tab.document.createElement("main");
    main.style.cssText =
      "margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0a0a0a;color:#e4e4e7;padding:2rem;text-align:center";
    const p = tab.document.createElement("p");
    p.textContent = `正在打包「${chapterTitle}」預覽，約需 1–3 分鐘，請保持此分頁開啟…`;
    main.appendChild(p);
    tab.document.body.replaceChildren(main);
  } catch {
    // 若無法寫入佔位頁，仍保留分頁供稍後導向
  }
  return tab;
}

function navigateChapterPreviewTab(tab: Window | null, url: string): boolean {
  if (tab && !tab.closed) {
    try {
      tab.location.href = url;
      tab.focus();
      return true;
    } catch {
      // fall through
    }
  }
  return window.open(url, "_blank", "noopener,noreferrer") !== null;
}

function ChapterIllustrationBlock({
  projectId,
  wvpChapterId,
  chapterTitle,
  scriptSteps,
  craftLocked,
  reloadKey,
  onOpenStepStudio,
}: {
  projectId: string;
  wvpChapterId: string;
  chapterTitle: string;
  scriptSteps: ChapterScriptStep[];
  craftLocked: boolean;
  reloadKey: number;
  onOpenStepStudio: () => void;
}) {
  return (
    <CraftChapterIllustration
      projectId={projectId}
      wvpChapterId={wvpChapterId}
      chapterTitle={chapterTitle}
      scriptSteps={scriptSteps}
      disabled={craftLocked}
      reloadKey={reloadKey}
      onOpenStepStudio={onOpenStepStudio}
    />
  );
}

const JOB_POLL_INTERVAL_MS = 2000;
const JOB_POLL_MAX_ATTEMPTS = 900;
const WVP_REFRESH_THROTTLE_MS = 5000;
const TRANSIENT_POLL_STATUS = new Set([502, 503, 504]);

function parseBatchProgress(raw: unknown): WvpBatchCraftProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const progress = (raw as { progress?: unknown }).progress;
  if (!progress || typeof progress !== "object") return null;
  const p = progress as WvpBatchCraftProgress;
  if (!Array.isArray(p.chapters) || typeof p.totalChapters !== "number") return null;
  return p;
}

async function readResponsePayload(response: Response): Promise<ResponsePayload> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as ResponsePayload) : {};
  } catch {
    return { rawText: text };
  }
}

function isLikelyHtmlResponse(response: Response, payload: ResponsePayload): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) return true;
  if (response.redirected && response.url.includes("/login")) return true;
  return typeof payload.rawText === "string" && /^\s*<!doctype html/i.test(payload.rawText);
}

function getResponseErrorMessage(
  response: Response,
  payload: ResponsePayload,
  fallback: string,
): string {
  if (isLikelyHtmlResponse(response, payload)) {
    return "登入狀態已失效，請重新登入後再試。";
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload.rawText === "string" && payload.rawText.trim()) {
    return payload.rawText;
  }
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  return `${fallback}（HTTP ${response.status}${statusText}）`;
}

function toBatchSummary(payload: ResponsePayload, fallbackTotal: number): BatchSummary {
  const raw = payload.summary;
  if (!raw || typeof raw !== "object") {
    return {
      total: fallbackTotal,
      synced: 0,
      generated: 0,
      failed: 0,
    };
  }
  const summary = raw as Record<string, unknown>;
  const toInt = (v: unknown, def = 0) => (typeof v === "number" ? v : def);
  return {
    total: toInt(summary.total, fallbackTotal),
    synced: toInt(summary.synced, 0),
    generated: toInt(summary.generated, 0),
    failed: toInt(summary.failed, 0),
  };
}

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
  initialComposition,
}: {
  projectId: string;
  initialLocks: WvpPhaseLocks;
  initialSettings: WvpSettings;
  initialThemeId: string | null;
  initialChapters: CraftRow[];
  initialComposition: CourseComposition;
}) {
  const [locks, setLocks] = useState(initialLocks);
  const [settings, setSettings] = useState(initialSettings);
  const [chapters, setChapters] = useState(initialChapters);
  const [composition, setComposition] = useState(initialComposition);
  const [selectedWvpId, setSelectedWvpId] = useState<string | null>(
    initialChapters[0]?.wvp_chapter_id ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [wvpHydrated, setWvpHydrated] = useState(false);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themePreviewLoaded, setThemePreviewLoaded] = useState(false);
  const [themePreviewFailed, setThemePreviewFailed] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [savingImageStyle, setSavingImageStyle] = useState(false);
  const [savingHookAssets, setSavingHookAssets] = useState(false);
  const [stepStudioChapter, setStepStudioChapter] = useState<{
    wvpChapterId: string;
    title: string;
  } | null>(null);
  const [illustrationReloadByChapter, setIllustrationReloadByChapter] = useState<
    Record<string, number>
  >({});
  const [batchProgress, setBatchProgress] = useState<WvpBatchCraftProgress | null>(null);
  const [failedBatchProgress, setFailedBatchProgress] = useState<WvpBatchCraftProgress | null>(
    null,
  );
  const [activeBatchJobId, setActiveBatchJobId] = useState<string | null>(null);
  const [batchQueueHint, setBatchQueueHint] = useState<string | null>(null);
  const [trialProgress, setTrialProgress] = useState<WvpTrialChapterProgress | null>(null);
  const [trialQueueHint, setTrialQueueHint] = useState<string | null>(null);
  const trialElapsedMs = useElapsedMs(busy === "trial-ch1");
  const trialCompactProgress = useMemo(() => {
    if (busy !== "trial-ch1") return null;
    if (trialProgress) return toTrialCompactProgress(trialProgress);
    return toTrialCompactProgress(
      null,
      estimateTrialOptimisticPhaseIndex(trialElapsedMs),
    );
  }, [busy, trialProgress, trialElapsedMs]);
  const autoScaffoldAttempted = useRef(false);
  const lastWvpRefreshAt = useRef(0);
  const lastMaterializedCount = useRef(0);
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
    chapters.length > 0 &&
    !!firstChapterWvpId &&
    providers.length > 0 &&
    !locks.craft;
  const selectedTheme = themes.find((t) => t.id === selectedThemeId);
  const selectedThemePreview = useMemo(() => {
    if (!selectedThemeId) return null;
    return resolveThemeGalleryMeta(
      selectedThemeId,
      selectedTheme?.nameZh ?? selectedThemeId,
      selectedTheme?.descriptionZh,
    );
  }, [selectedThemeId, selectedTheme?.nameZh, selectedTheme?.descriptionZh]);

  useEffect(() => {
    preloadAllThemeGalleryImages();
    fetch("/api/themes")
      .then((r) => r.json())
      .then((d) => setThemes(d.themes ?? []));
  }, []);

  useEffect(() => {
    const url = selectedThemePreview?.imageUrl;
    if (!url) {
      setThemePreviewLoaded(false);
      setThemePreviewFailed(false);
      return;
    }
    if (isThemePreviewCached(url)) {
      setThemePreviewLoaded(true);
      setThemePreviewFailed(false);
      return;
    }
    setThemePreviewLoaded(false);
    setThemePreviewFailed(false);
  }, [selectedThemePreview?.imageUrl]);

  useEffect(() => {
    if (!selectedThemeId) return;
    const ids = themes.length > 0 ? themes.map((t) => t.id) : [selectedThemeId];
    const idx = ids.indexOf(selectedThemeId);
    const neighborIds: string[] =
      idx >= 0
        ? [ids[idx]!, ...(idx > 0 ? [ids[idx - 1]!] : []), ...(idx < ids.length - 1 ? [ids[idx + 1]!] : [])]
        : [selectedThemeId];
    preloadThemeGalleryImages(neighborIds);
  }, [selectedThemeId, themes]);

  const refreshWvp = useCallback(async (opts?: { hydrateDist?: boolean }) => {
    const query = opts?.hydrateDist ? "" : "?light=1";
    const res = await fetch(`/api/projects/${projectId}/wvp${query}`);
    const data = await readResponsePayload(res);
    if (!res.ok) {
      setWvpHydrated(true);
      return;
    }
    if (isLikelyHtmlResponse(res, data)) {
      setWvpHydrated(true);
      throw new Error("登入狀態已失效，請重新登入後再試。");
    }
    setChapters(Array.isArray(data.chapters) ? data.chapters : []);
    if (data.wvpSettings && typeof data.wvpSettings === "object") {
      setSettings(data.wvpSettings as WvpSettings);
    }
    setWvpHydrated(true);
  }, [projectId]);

  useEffect(() => {
    void refreshWvp();
    const hydrateInBackground = () => void refreshWvp({ hydrateDist: true });
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(hydrateInBackground, { timeout: 5000 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timerId = window.setTimeout(hydrateInBackground, 2000);
    return () => window.clearTimeout(timerId);
  }, [refreshWvp]);

  const saveWvpSettings = useCallback(async (overrideThemeId?: string) => {
    const themeToSave = overrideThemeId ?? selectedThemeId;
    if (!themeToSave) {
      throw new Error("請先選擇簡報主題");
    }
    setSavingTheme(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wvpSettings: { ...settings, themeId: themeToSave, devMode: "sequential" as const },
          themeId: themeToSave,
        }),
      });
      const data = await readResponsePayload(res);
      if (!res.ok) throw new Error(getResponseErrorMessage(res, data, "儲存失敗"));
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

  const saveChapterMotionOrientation = async (
    wvpChapterId: string,
    orientation: ChapterMotionOrientation,
  ) => {
    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/motion-orientation`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orientation }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "動效取向儲存失敗");
    setChapters((prev) =>
      prev.map((ch) =>
        ch.wvp_chapter_id === wvpChapterId
          ? {
              ...ch,
              checklist_result: {
                ...ch.checklist_result,
                motionOrientation: orientation,
              },
            }
          : ch,
      ),
    );
    return data as { label?: string };
  };

  const saveEnterMotionStyle = async (style: EnterMotionStyle) => {
    const next: WvpSettings = { ...settings, enterMotionStyle: style };
    setSettings(next);
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
      toast(`已設定進場風格：${ENTER_MOTION_STYLE_LABELS[style]}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "進場風格儲存失敗", "error");
    }
  };

  const saveChapterTemplate = async (
    wvpChapterId: string,
    next: WvpChapterKind | "auto",
  ) => {
    const craft = chapters.find((c) => c.wvp_chapter_id === wvpChapterId);
    if (!craft) throw new Error("找不到章節");
    const { contentChapterId } = resolveChapterTemplateSelectState(composition, craft);
    if (!contentChapterId) throw new Error("找不到對應文稿章節");

    const res = await fetch(
      `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/chapter-kind`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          next === "auto" ? { auto: true } : { chapterKind: next },
        ),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "版型儲存失敗");

    const nextKind = next === "auto" ? undefined : next;
    setComposition((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === contentChapterId ? { ...ch, chapterKind: nextKind } : ch,
      ),
    }));
    return data as {
      inferredKind?: WvpChapterKind;
      inferredDisplayKind?: string;
      isAuto?: boolean;
    };
  };

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

  const persistWvpAssets = async (nextAssets: WvpAssetRef[]) => {
    const next: WvpSettings = { ...settings, assets: nextAssets };
    setSettings(next);
    setSavingHookAssets(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wvpSettings: { ...next, devMode: "sequential" as const },
          themeId: next.themeId ?? initialThemeId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "開場圖儲存失敗");
      toast("開場圖已儲存", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "開場圖儲存失敗", "error");
    } finally {
      setSavingHookAssets(false);
    }
  };

  const clearImageStyle = async () => {
    const next: WvpSettings = { ...settings, imageStyle: null };
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
      toast("已清除生圖風格，將改用簡報主題配色生圖", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "清除風格失敗", "error");
    } finally {
      setSavingImageStyle(false);
    }
  };

  const pollJobRun = useCallback(
    async (
      jobRunId: string,
      hooks?: {
        onRunning?: (result: ResponsePayload) => void;
        onPending?: () => void;
        throttleRefresh?: () => void;
      },
    ): Promise<ResponsePayload> => {
      const run = async (attempt: number): Promise<ResponsePayload> => {
        let res: Response;
        let payload: ResponsePayload = {};

        try {
          res = await fetch(`/api/job-runs/${jobRunId}`);
          payload = await readResponsePayload(res);
        } catch {
          if (attempt >= JOB_POLL_MAX_ATTEMPTS) {
            throw new Error("任務狀態查詢逾時，請稍後重新整理頁面確認結果");
          }
          await new Promise((resolve) => window.setTimeout(resolve, JOB_POLL_INTERVAL_MS));
          return run(attempt + 1);
        }

        if (!res.ok) {
          if (TRANSIENT_POLL_STATUS.has(res.status) && attempt < JOB_POLL_MAX_ATTEMPTS) {
            await new Promise((resolve) => window.setTimeout(resolve, JOB_POLL_INTERVAL_MS));
            return run(attempt + 1);
          }
          throw new Error(getResponseErrorMessage(res, payload, "無法查詢任務狀態"));
        }

        const jobRaw = payload.job;
        const job = jobRaw && typeof jobRaw === "object"
          ? (jobRaw as {
              status?: string;
              error_message?: string | null;
              result?: Record<string, unknown>;
            })
          : undefined;
        const status = job?.status;

        if (status === "completed" || status === "cancelled") {
          const result = job?.result;
          return result && typeof result === "object" ? (result as ResponsePayload) : {};
        }
        if (status === "failed") {
          const result = job?.result;
          const progress = parseBatchProgress(result);
          if (progress) setFailedBatchProgress(progress);
          throw new Error(job?.error_message ?? "背景任務失敗");
        }

        if (status === "pending") {
          const result = job?.result;
          if (result && typeof result === "object") {
            hooks?.onRunning?.(result as ResponsePayload);
          } else {
            hooks?.onPending?.();
          }
        }

        if (status === "running" || status === "cancelling") {
          const result = job?.result;
          if (result && typeof result === "object") {
            hooks?.onRunning?.(result as ResponsePayload);
            hooks?.throttleRefresh?.();
          }
        }

        if (attempt >= JOB_POLL_MAX_ATTEMPTS) {
          throw new Error("任務執行時間過長（>30 分鐘），請稍後重新整理頁面確認狀態");
        }

        await new Promise((resolve) => window.setTimeout(resolve, JOB_POLL_INTERVAL_MS));
        return run(attempt + 1);
      };

      return run(0);
    },
    [],
  );

  const cancelBatchCraft = async () => {
    if (!activeBatchJobId) return;
    try {
      const res = await fetch(`/api/job-runs/${activeBatchJobId}/cancel`, { method: "POST" });
      const data = await readResponsePayload(res);
      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "取消失敗"));
      }
      toast(
        typeof data.message === "string" ? data.message : "已送出取消請求",
        "info",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "取消失敗", "error");
    }
  };

  const batchCraftAll = async (
    onlyMissing: boolean,
    opts?: { resumeFromSortOrder?: number; parentJobRunId?: string },
  ) => {
    if (!defaultProvider) {
      toast("請先在設定頁填寫 LLM API Key", "error");
      return;
    }
    if (chapters.length === 0) {
      toast("請先建立章節清單", "error");
      return;
    }
    setBusy("batch-craft");
    setFailedBatchProgress(null);
    setActiveBatchJobId(null);
    setBatchQueueHint("正在送出批次任務…");
    lastMaterializedCount.current = 0;
    if (chapters.length > 0) {
      setBatchProgress(
        createInitialBatchProgress(
          chapters.map((ch) => ({
            wvpChapterId: ch.wvp_chapter_id,
            title: ch.title,
            sortOrder: ch.sort_order,
          })),
        ),
      );
    } else {
      setBatchProgress(null);
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp/batch-craft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: defaultProvider,
          onlyMissing,
          resumeFromSortOrder: opts?.resumeFromSortOrder,
          parentJobRunId: opts?.parentJobRunId,
        }),
      });
      const data = await readResponsePayload(res);
      let finalData = data;

      if (res.status === 202 && typeof data.jobRunId === "string") {
        setActiveBatchJobId(data.jobRunId);
        toast(
          typeof data.message === "string" && data.message
            ? data.message
            : "全課批次已開始，請稍候…",
          "info",
        );
        setBatchQueueHint("等待 Worker 接手…");
        finalData = await pollJobRun(data.jobRunId, {
          onPending: () => {
            setBatchQueueHint("任務排隊中，等待 Worker…");
          },
          onRunning: (result) => {
            setBatchQueueHint(null);
            const progress = parseBatchProgress(result);
            if (!progress) return;
            setBatchProgress(progress);
            const materialized = progress.chapters.filter(
              (ch) => ch.status === "materialized",
            ).length;
            if (materialized > lastMaterializedCount.current) {
              lastMaterializedCount.current = materialized;
              void refreshWvp();
            }
          },
          throttleRefresh: () => {
            const now = Date.now();
            if (now - lastWvpRefreshAt.current < WVP_REFRESH_THROTTLE_MS) return;
            lastWvpRefreshAt.current = now;
            void refreshWvp();
          },
        });
        const doneProgress = parseBatchProgress(finalData);
        if (doneProgress) setBatchProgress(doneProgress);
      } else if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "批次處理失敗"));
      }

      await refreshWvp();
      const s = toBatchSummary(finalData, chapters.length);
      const cancelled = finalData.cancelled === true;
      if (cancelled) {
        playWarningSound();
        toast("批次已取消；已完成章節已保留。", "info");
      } else if (s.failed && s.failed > 0) {
        playWarningSound();
        const progress = parseBatchProgress(finalData);
        if (progress) setFailedBatchProgress(progress);
        toast(
          `已完成 ${s.generated}/${s.total} 章 AI 產生；${s.failed} 章有錯誤（可從失敗章節續跑）`,
          "info",
        );
      } else {
        toast(
          `已處理 ${s.total} 章：匯入口播 ${s.synced}、產生畫面 ${s.generated}。請前往「3. 語音生成」，再到「4. 預覽匯出」打包。`,
          "success",
          { taskComplete: true },
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "批次處理失敗", "error");
    } finally {
      setBusy(null);
      setActiveBatchJobId(null);
      setBatchQueueHint(null);
    }
  };

  const canPreviewChapter = (ch: CraftRow): boolean =>
    (ch.checklist_result?.narrations?.length ?? 0) > 0 &&
    Boolean(ch.checklist_result?.chapterSource);

  const previewChapter = async (wvpChapterId: string, chapterTitle: string) => {
    if (!hasSelectedTheme) {
      toast("請先選擇並儲存簡報主題", "error");
      return;
    }
    const ch = chapters.find((row) => row.wvp_chapter_id === wvpChapterId);
    const templateState = ch
      ? resolveChapterTemplateSelectState(composition, ch)
      : null;
    const isHookPreview =
      templateState !== null && chapterEffectiveTemplateKind(templateState) === "hook";
    if (isHookPreview) {
      let illustrationSteps: Array<{
        stepIndex: number;
        imageWritten?: boolean;
        status?: string;
      }> | undefined;
      if (countHookChapterAssets(settings.assets, wvpChapterId) < 3) {
        try {
          const illusRes = await fetch(
            `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/illustrations`,
          );
          const illusData = await readResponsePayload(illusRes);
          if (illusRes.ok && Array.isArray(illusData.steps)) {
            illustrationSteps = illusData.steps as Array<{
              stepIndex: number;
              imageWritten?: boolean;
              status?: string;
            }>;
          }
        } catch {
          // 無法載入配圖狀態時仍顯示警告
        }
      }
      const warnMsg = hookPreviewWarningMessage(
        settings.assets,
        wvpChapterId,
        illustrationSteps,
      );
      if (warnMsg) {
        playWarningSound();
        toast(HOOK_OPENING_HINT, "warning");
        if (!window.confirm(warnMsg)) return;
      }
    }
    const previewTab = openChapterPreviewPlaceholderTab(chapterTitle);
    if (!previewTab) {
      toast(
        "瀏覽器阻擋新分頁。請允許 courseflow2.zeabur.app 開啟彈出視窗後再按「預覽」。",
        "warning",
      );
    }
    setBusy(`preview-${wvpChapterId}`);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${wvpChapterId}/preview`,
        { method: "POST" },
      );
      const data = await readResponsePayload(res);
      if (!res.ok) {
        if (previewTab && !previewTab.closed) previewTab.close();
        throw new Error(getResponseErrorMessage(res, data, "預覽打包失敗"));
      }
      const previewUrl =
        typeof data.previewUrl === "string" && data.previewUrl
          ? data.previewUrl
          : `/projects/${projectId}/wvp-play?chapterPreview=1`;
      const opened = navigateChapterPreviewTab(previewTab, previewUrl);
      if (
        typeof data.illustrationSyncWarning === "string" &&
        data.illustrationSyncWarning
      ) {
        toast(`「${chapterTitle}」預覽已打包。${data.illustrationSyncWarning}`, "info");
      } else if (opened) {
        toast(`「${chapterTitle}」預覽已打包，已開啟新分頁。`, "success");
      } else {
        toast(
          `「${chapterTitle}」預覽已打包，但無法自動開啟分頁。請允許彈出視窗，或手動開啟：${previewUrl}`,
          "warning",
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "預覽打包失敗", "error");
    } finally {
      setBusy(null);
    }
  };

  const generateChapter = async (wvpChapterId: string) => {
    if (!defaultProvider) {
      toast("請先在設定頁填寫 LLM API Key", "error");
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
    if (
      anchorTrialDone &&
      !window.confirm(
        "重新試執行將覆寫第 1 章畫面，並清除「已確認第 1 章風格」。是否繼續？",
      )
    ) {
      return;
    }
    setBusy("trial-ch1");
    setTrialProgress(createInitialTrialProgress(chapters[0]?.title));
    setTrialQueueHint(null);
    try {
      await saveWvpSettings();
      const res = await fetch(`/api/projects/${projectId}/wvp/trial-chapter-1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: defaultProvider }),
      });
      const data = await readResponsePayload(res);
      let finalData = data;

      if (res.status === 202 && typeof data.jobRunId === "string") {
        toast(
          typeof data.message === "string" && data.message
            ? data.message
            : "第 1 章試執行已開始（雲端約 3–8 分鐘，含 Vite 打包），請保持此頁開啟…",
          "info",
        );
        setTrialQueueHint("等待 Worker 接手…");
        finalData = await pollJobRun(data.jobRunId, {
          onPending: () => {
            setTrialQueueHint("任務排隊中，等待 Worker…");
          },
          onRunning: (result) => {
            setTrialQueueHint(null);
            const progress = parseWvpTrialProgress(result);
            if (progress) setTrialProgress(progress);
          },
        });
        const doneProgress = parseWvpTrialProgress(finalData);
        if (doneProgress) setTrialProgress(doneProgress);
      } else if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "試執行失敗"));
      }

      setSettings((s) => ({
        ...s,
        anchorChapterTrialCompleted: true,
        anchorChapterApproved: false,
        anchorProfile: undefined,
      }));
      await refreshWvp();
      if (
        typeof finalData.illustrationSyncWarning === "string" &&
        finalData.illustrationSyncWarning
      ) {
        toast(
          anchorTrialDone
            ? `第 1 章已重新試執行。${finalData.illustrationSyncWarning}`
            : `第 1 章試執行完成。${finalData.illustrationSyncWarning}`,
          "info",
        );
        playFinishedSound();
      } else {
        toast(
          anchorTrialDone ? "第 1 章已重新試執行，可開啟預覽查看。" : "第 1 章試執行完成，可開啟預覽查看。",
          "success",
          { taskComplete: true },
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "試執行失敗", "error");
    } finally {
      setBusy(null);
      setTrialProgress(null);
      setTrialQueueHint(null);
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

      <div className="mx-auto w-full max-w-3xl">
        <aside className="cf-card cf-card-padded space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">簡報主題</h3>
              <label className="block text-[11px] text-zinc-500">
                決定整體視覺風格。
                <select
                  className="cf-select mt-1 w-full text-sm md:w-1/2"
                  disabled={locks.craft}
                  value={selectedThemeId}
                  onChange={(e) => {
                    const newId = e.target.value || null;
                    setSettings((s) => ({ ...s, themeId: newId }));
                    if (newId && !locks.craft) {
                      saveWvpSettings(newId).then(() => {
                        toast("主題已儲存", "success");
                      }).catch((err) => {
                        toast(err instanceof Error ? err.message : "儲存主題失敗", "error");
                      });
                    }
                  }}
                >
                  <option value="">選擇主題</option>
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameZh}{savingTheme && selectedThemeId === t.id ? " …" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {!hasSelectedTheme ? (
                <p className="text-[11px] text-amber-500/90">請先選擇簡報主題</p>
              ) : savingTheme ? (
                <p className="text-[11px] text-zinc-500">儲存中…</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">主題預覽</h3>
              <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
                {selectedThemeId && !themePreviewLoaded ? (
                  <div
                    className="absolute inset-0 z-10 flex aspect-video w-full items-center justify-center bg-zinc-900/70"
                    aria-busy="true"
                    aria-label="主題預覽載入中"
                  >
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
                  </div>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedThemePreview?.imageUrl ?? themeGalleryFallbackImage}
                  alt={selectedTheme?.nameZh ?? selectedThemePreview?.subtitleZh ?? "主題預覽"}
                  className={`aspect-video w-full object-cover transition-opacity duration-200 ${themePreviewLoaded ? "opacity-100" : "opacity-0"}`}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  ref={(el) => {
                    const url = selectedThemePreview?.imageUrl;
                    if (!el || !url) return;
                    if (el.complete && el.naturalWidth > 0) {
                      markThemePreviewCached(url);
                      if (!themePreviewLoaded) setThemePreviewLoaded(true);
                    }
                  }}
                  onLoad={(e) => {
                    const url = selectedThemePreview?.imageUrl;
                    if (url) markThemePreviewCached(url);
                    setThemePreviewLoaded(true);
                    void e;
                  }}
                  onError={() => {
                    setThemePreviewFailed(true);
                    setThemePreviewLoaded(true);
                  }}
                />
                {themePreviewFailed ? (
                  <p className="px-3 py-2 text-[11px] text-amber-500/90">預覽圖載入失敗，請重新整理或稍後再試。</p>
                ) : null}
                <div className="space-y-1 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {selectedTheme?.nameZh ?? "請先選擇主題"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {selectedThemePreview?.subtitleZh ?? "選定主題後會顯示對應預覽與說明。"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {selectedThemePreview?.bestForZh ?? ""}
                  </p>
                </div>
              </div>
            </div>
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
                title="AI 視覺動效產生"
                hint="按「開始執行」會自動完成所有章節的口播匯入與 AI 視覺程式產生，全程無需手動逐章操作。下方章節列表的「匯入口播」與「AI 畫面」按鈕僅供修改文稿後重新同步個別章節使用。"
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
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400/90">
                        已選：{settings.imageStyle?.titleZh}
                        <button
                          type="button"
                          disabled={!!busy || locks.craft || savingImageStyle}
                          onClick={() => void clearImageStyle()}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                          title="清除風格，改用簡報主題配色"
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500/80">尚未選擇（可選，預設跟隨主題配色）</span>
                    )}
                  </div>
                  {hasImageStyle ? (
                    <p className="text-[11px] leading-snug text-zinc-600">
                      配圖請在下方「配圖工作室」各章確認提示詞後生圖；打包階段不再自動生圖。
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-[11px] text-zinc-500">
                      全課進場風格
                      <select
                        className="cf-select ml-2 min-w-[9rem] py-1.5 text-xs"
                        disabled={!!busy || locks.craft}
                        value={settings.enterMotionStyle ?? "standard"}
                        onChange={(e) =>
                          void saveEnterMotionStyle(e.target.value as EnterMotionStyle)
                        }
                      >
                        {(Object.entries(ENTER_MOTION_STYLE_LABELS) as [EnterMotionStyle, string][]).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <span className="text-[10px] text-zinc-600">
                      打包時套用至各步進場／轉場；章節「極簡」取向會再弱化進場。
                    </span>
                  </div>
                </div>
                {!anchorOk ? (
                  <div className="mb-3 w-full space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
                    <p className="text-sm font-medium text-emerald-100/90">
                      請先驗收第 1 章風格，確認無誤後才能執行全課「開始執行」。
                    </p>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      系統會依 Checkpoint 素材自動選擇 Hook 或清單揭示模板，無需手動逐一套用。不滿意結果可再次試執行。
                    </p>
                    <div className="flex w-full flex-wrap items-start gap-2">
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="cf-btn cf-btn-primary cf-btn-sm"
                          disabled={!!busy || !canTrialChapter1}
                          onClick={() => void trialChapter1()}
                        >
                          {busy === "trial-ch1"
                            ? "試執行中…"
                            : anchorTrialDone
                              ? "重新試執行第 1 章"
                              : "試執行第 1 章"}
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
                      <CompactBatchProgressPanel
                        progress={trialCompactProgress}
                        busy={busy === "trial-ch1"}
                        queueHint={trialQueueHint}
                        estimateRemainingMs={
                          trialProgress
                            ? () => estimateTrialRemainingMs(trialProgress)
                            : undefined
                        }
                      />
                    </div>
                    {anchorTrialDone && !anchorOk ? (
                      <p className="text-[11px] text-amber-500/90">
                        請在預覽畫面底部按「已確認第 1 章風格」。
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex w-full flex-wrap items-start gap-2">
                  <div className="flex shrink-0 flex-wrap gap-2">
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
                        !anchorOk ||
                        !anchorTrialDone
                      }
                      onClick={() => batchCraftAll(true)}
                      title="只對尚未產生畫面的章節執行 AI"
                    >
                      僅補未完成
                    </button>
                  </div>
                  <BatchCraftProgressPanel
                    compact
                    progress={batchProgress}
                    busy={busy === "batch-craft"}
                    queueHint={batchQueueHint}
                    onCancel={activeBatchJobId ? () => void cancelBatchCraft() : undefined}
                    onResume={(sortOrder) =>
                      void batchCraftAll(false, { resumeFromSortOrder: sortOrder })
                    }
                    failedJobProgress={failedBatchProgress}
                  />
                </div>
              </CraftWorkflowStep>

            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">章節列表</h3>
              {chapters.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  正常使用上方「開始執行」即可，無需手動逐章操作。
                  若修改了某章文稿，可調整版型、用「匯入口播」重新同步口播，再用「AI 畫面」重新產生視覺。
                </p>
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
                const isPreviewing = busy === `preview-${ch.wvp_chapter_id}`;
                const previewReady = canPreviewChapter(ch);
                const templateState = resolveChapterTemplateSelectState(composition, ch);
                const batchCh = (batchProgress ?? failedBatchProgress)?.chapters.find(
                  (row) => row.wvpChapterId === ch.wvp_chapter_id,
                );
                const batchBadge =
                  batchCh?.status === "materialized"
                    ? "✓"
                    : batchCh?.status === "running" || batchCh?.status === "generated"
                      ? "⟳"
                      : batchCh?.status === "failed"
                        ? "✗"
                        : null;
                const effectiveKind = chapterEffectiveTemplateKind(templateState);
                const isHookChapter = effectiveKind === "hook";
                const hookAssetCount = (settings.assets ?? []).filter(
                  (a) => a.url?.trim() && a.wvpChapterId === ch.wvp_chapter_id,
                ).length;

                return (
                  <div key={ch.id} className="space-y-1">
                  <div
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
                      <span className="line-clamp-2 text-sm font-medium leading-snug">
                        {batchBadge ? (
                          <span className="mr-1 text-emerald-500/90">{batchBadge}</span>
                        ) : null}
                        {ch.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">
                        {STATUS_LABEL[ch.craft_status] ?? ch.craft_status}
                        {ch.step_count > 0 ? ` · ${ch.step_count} 步` : ""}
                        {(ch.checklist_result?.narrations?.length ?? 0) > 0 ? " · 已匯入" : ""}
                        {ch.checklist_result?.chapterSource ? " · 有畫面" : ""}
                        {ch.checklist_result?.chapterSource &&
                        resolveCraftTemplateKind(ch.checklist_result)
                          ? `（${templateKindDisplayLabel(resolveCraftTemplateKind(ch.checklist_result)!)}）`
                          : templateState.isAuto
                            ? `（推斷：${templateKindDisplayLabel(templateState.inferredDisplayKind)}）`
                            : `（指定：${templateKindDisplayLabel(templateState.selectValue)}）`}
                        {` · 動效：${CHAPTER_MOTION_ORIENTATION_LABELS[parseChapterMotionOrientation(ch.checklist_result?.motionOrientation)]}`}
                        {i === 0 ? " · 第 1 章" : ""}
                      </span>
                    </button>
                    {isHookChapter && !locks.craft ? (
                      <div
                        className="shrink-0 self-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChapterOutlineImages
                          projectId={projectId}
                          wvpChapterId={ch.wvp_chapter_id}
                          assets={settings.assets ?? []}
                          locked={locks.craft || savingHookAssets}
                          variant="hook"
                          compact
                          onAssetsChange={(next) => void persistWvpAssets(next)}
                        />
                      </div>
                    ) : null}
                    {!locks.craft ? (
                      <div className="flex shrink-0 items-stretch gap-1">
                        <button
                          type="button"
                          title={
                            previewReady
                              ? "打包並預覽本章（僅含此章節，不含語音）"
                              : "請先匯入口播並產生 AI 畫面"
                          }
                          className="cf-btn cf-btn-secondary w-[2.75rem] shrink-0 px-0.5 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy || !previewReady || !hasSelectedTheme}
                          onClick={(e) => {
                            e.stopPropagation();
                            void previewChapter(ch.wvp_chapter_id, ch.title);
                          }}
                        >
                          {isPreviewing ? "…" : "預覽"}
                        </button>
                        <select
                          className="cf-select w-[5.5rem] shrink-0 py-1.5 text-[10px] leading-normal"
                          disabled={!!busy}
                          title="本章解說動效整體取向（打包時提高對應 pattern 優先權）"
                          value={parseChapterMotionOrientation(ch.checklist_result?.motionOrientation)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const next = e.target.value as ChapterMotionOrientation;
                            setBusy(`motion-${ch.wvp_chapter_id}`);
                            try {
                              const saved = await saveChapterMotionOrientation(
                                ch.wvp_chapter_id,
                                next,
                              );
                              toast(
                                `已設定動效取向：${saved.label ?? CHAPTER_MOTION_ORIENTATION_LABELS[next]}`,
                                "success",
                              );
                            } catch (err) {
                              toast(
                                err instanceof Error ? err.message : "動效取向儲存失敗",
                                "error",
                              );
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          {MOTION_ORIENTATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} title={opt.title}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="cf-select w-[6.25rem] shrink-0 py-1.5 text-[10px] leading-normal"
                          disabled={!!busy || !templateState.contentChapterId}
                          title={
                            templateState.isAuto
                              ? `依內容推斷為「${templateKindDisplayLabel(templateState.inferredDisplayKind)}」，可改為其他版型`
                              : "已手動指定版型，選「自動」可改回依內容推斷"
                          }
                          value={templateState.isAuto ? "__auto__" : templateState.selectValue}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const raw = e.target.value;
                            const next =
                              raw === "__auto__"
                                ? ("auto" as const)
                                : (raw as WvpChapterKind);
                            setBusy(`tpl-${ch.wvp_chapter_id}`);
                            try {
                              const saved = await saveChapterTemplate(ch.wvp_chapter_id, next);
                              if (next === "hook") {
                                setSelectedWvpId(ch.wvp_chapter_id);
                                toast(HOOK_OPENING_HINT, "info");
                              } else {
                                toast(
                                  next === "auto"
                                    ? `已改為自動推斷（${templateKindDisplayLabel(
                                        saved.inferredDisplayKind ??
                                          templateState.inferredDisplayKind,
                                      )}）`
                                    : `已指定版型：${templateKindDisplayLabel(next)}`,
                                  "success",
                                );
                              }
                            } catch (err) {
                              toast(
                                err instanceof Error ? err.message : "版型儲存失敗",
                                "error",
                              );
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          <option value="__auto__">自動</option>
                          {CRAFT_TEMPLATE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="從文稿重新匯入本章口播內容（文稿有修改時用）"
                          className="cf-btn cf-btn-secondary w-[3.35rem] shrink-0 px-0.5 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy}
                          onClick={() => syncChapter(ch.wvp_chapter_id)}
                        >
                          {isSyncing ? "…" : "匯入口播"}
                        </button>
                        <button
                          type="button"
                          title="用 AI 重新產生本章視覺動效程式（口播已匯入後才有效果）"
                          className="cf-btn cf-btn-secondary w-[3.35rem] shrink-0 px-0.5 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy || !providers.length}
                          onClick={() => generateChapter(ch.wvp_chapter_id)}
                        >
                          {isGenerating ? "…" : "AI 畫面"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {isHookChapter && !locks.craft ? (
                    <div
                      className="rounded border border-amber-800/45 bg-amber-950/25 px-2.5 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] leading-relaxed text-amber-200/90">
                        <span className="font-medium text-amber-100/95">多圖開場</span>
                        ：{HOOK_OPENING_HINT}
                        {hookAssetCount < 3
                          ? `（目前已上傳 ${hookAssetCount}／3 張）`
                          : "（已上傳 3 張）"}
                        {savingHookAssets ? " 儲存中…" : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        順序對應預覽步驟 2–4（幽靈格 01–03）。上傳後請按「AI 畫面」，再到「4.
                        預覽匯出」打包。
                      </p>
                      <div className="mt-1.5">
                        <ChapterOutlineImages
                          projectId={projectId}
                          wvpChapterId={ch.wvp_chapter_id}
                          assets={settings.assets ?? []}
                          locked={locks.craft || savingHookAssets}
                          variant="hook"
                          onAssetsChange={(next) => void persistWvpAssets(next)}
                        />
                      </div>
                    </div>
                  ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {chapters.length > 0 ? (
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">配圖工作室</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  設定各章節配圖；多圖開場可在章節列直接上傳，或點「步驟配圖」逐張調整。
                </p>
              </div>
              {chapters.map((ch, i) => (
                <ChapterIllustrationBlock
                  key={ch.wvp_chapter_id}
                  projectId={projectId}
                  wvpChapterId={ch.wvp_chapter_id}
                  chapterTitle={ch.title}
                  scriptSteps={chapterScriptSteps(
                    composition,
                    ch.wvp_chapter_id,
                    i,
                  )}
                  craftLocked={locks.craft}
                  reloadKey={illustrationReloadByChapter[ch.wvp_chapter_id] ?? 0}
                  onOpenStepStudio={() =>
                    setStepStudioChapter({
                      wvpChapterId: ch.wvp_chapter_id,
                      title: ch.title,
                    })
                  }
                />
              ))}
            </div>
          ) : null}

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

      {stepStudioChapter ? (
        <CraftStepIllustrationModal
          open
          projectId={projectId}
          wvpChapterId={stepStudioChapter.wvpChapterId}
          chapterTitle={stepStudioChapter.title}
          disabled={locks.craft}
          onClose={() => setStepStudioChapter(null)}
          onMutate={() =>
            setIllustrationReloadByChapter((prev) => ({
              ...prev,
              [stepStudioChapter.wvpChapterId]:
                (prev[stepStudioChapter.wvpChapterId] ?? 0) + 1,
            }))
          }
        />
      ) : null}

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
