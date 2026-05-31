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
import { CraftChapterIllustration } from "@/components/CraftChapterIllustration";
import {
  resolveThemeGalleryMeta,
  themeGalleryFallbackImage,
} from "@/data/theme-gallery";

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

const JOB_POLL_INTERVAL_MS = 2000;
const JOB_POLL_MAX_ATTEMPTS = 900;
const TRANSIENT_POLL_STATUS = new Set([502, 503, 504]);

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

// ─── self-check report types ──────────────────────────────────────────────
type SelfCheckSeverity = "ok" | "warn" | "fail";
interface SelfCheckFinding { level: SelfCheckSeverity; message: string }
interface SelfCheckStepResult {
  pageLabel: string;
  chapterId: string;
  narration: string;
  largestVisibleFontPx: number;
  hasOverflow: boolean;
  pageNumberOk: boolean | null;
  subtitleVisible: boolean;
  subtitleTextMatches: boolean;
  findings: SelfCheckFinding[];
}
type SelfCheckReport =
  | { exists: false }
  | { exists: true; totals: { ok: number; warn: number; fail: number }; results: SelfCheckStepResult[] };

function worstLevel(findings: SelfCheckFinding[]): SelfCheckSeverity {
  if (findings.some((f) => f.level === "fail")) return "fail";
  if (findings.some((f) => f.level === "warn")) return "warn";
  return "ok";
}

function SelfCheckPanel({ report }: { report: SelfCheckReport | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!report) {
    return (
      <p className="text-[11px] text-zinc-500">
        排版自檢尚未執行。在本機 presentation 目錄執行{" "}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">npm run self-check</code>
        {" "}後重新整理即可查看結果。
      </p>
    );
  }
  if (!report.exists) {
    return (
      <p className="text-[11px] text-zinc-500">
        尚無排版自檢報告。在本機 presentation 目錄執行{" "}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">npm run self-check</code>
        {" "}後重新整理即可查看結果。
      </p>
    );
  }

  const { totals, results } = report;
  const hasFail = totals.fail > 0;
  const hasWarn = totals.warn > 0;
  const summaryColor = hasFail
    ? "text-red-400"
    : hasWarn
      ? "text-amber-400"
      : "text-emerald-400";

  const failItems = results.filter((r) => worstLevel(r.findings) === "fail");
  const warnItems = results.filter((r) => worstLevel(r.findings) === "warn");
  const showItems = expanded ? [...failItems, ...warnItems] : failItems.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-medium ${summaryColor}`}>
          {hasFail ? "✗" : hasWarn ? "△" : "✓"}{" "}
          ok {totals.ok} / warn {totals.warn} / fail {totals.fail}
        </span>
        {(hasFail || hasWarn) ? (
          <button
            type="button"
            className="text-[11px] text-zinc-400 underline hover:text-zinc-200"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "收起" : "查看詳情"}
          </button>
        ) : null}
      </div>

      {showItems.length > 0 ? (
        <ul className="space-y-1.5">
          {showItems.map((r) => {
            const level = worstLevel(r.findings);
            const failMsgs = r.findings.filter((f) => f.level !== "ok");
            return (
              <li
                key={`${r.chapterId}-${r.pageLabel}`}
                className={`rounded border px-2 py-1 text-[11px] ${
                  level === "fail"
                    ? "border-red-800/50 bg-red-950/30 text-red-300"
                    : "border-amber-800/50 bg-amber-950/30 text-amber-300"
                }`}
              >
                <span className="font-mono font-semibold">{r.pageLabel}</span>
                {" — "}
                {failMsgs.map((f) => f.message).join("；")}
              </li>
            );
          })}
          {!expanded && failItems.length > 3 ? (
            <li className="text-[11px] text-zinc-500">
              … 還有 {failItems.length - 3} 項 fail，按「查看詳情」展開
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
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
  const [themes, setThemes] = useState<ThemeOption[]>([]);
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
    chapters.length > 0 &&
    !!firstChapterWvpId &&
    providers.length > 0 &&
    !locks.craft;
  const selectedTheme = themes.find((t) => t.id === selectedThemeId);
  const selectedThemePreview = selectedTheme
    ? resolveThemeGalleryMeta(
        selectedTheme.id,
        selectedTheme.nameZh,
        selectedTheme.descriptionZh,
      )
    : null;

  // ── self-check report ──────────────────────────────────────────────────
  const [selfCheckReport, setSelfCheckReport] = useState<SelfCheckReport | null>(null);

  const refreshSelfCheck = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp/self-check-report`);
      if (!res.ok) return;
      const data = (await res.json()) as SelfCheckReport;
      setSelfCheckReport(data);
    } catch {
      // report not available — not an error
    }
  }, [projectId]);

  useEffect(() => {
    fetch("/api/themes")
      .then((r) => r.json())
      .then((d) => setThemes(d.themes ?? []));
  }, []);

  useEffect(() => {
    void refreshSelfCheck();
  }, [refreshSelfCheck]);

  const refreshWvp = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/wvp`);
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
    async (jobRunId: string): Promise<ResponsePayload> => {
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

        if (status === "completed") {
          const result = job?.result;
          return result && typeof result === "object" ? (result as ResponsePayload) : {};
        }
        if (status === "failed") {
          throw new Error(job?.error_message ?? "背景任務失敗");
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

  const batchCraftAll = async (onlyMissing: boolean) => {
    if (!defaultProvider) {
      toast("請先在設定頁填寫 LLM API Key", "error");
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
      const data = await readResponsePayload(res);
      let finalData = data;

      if (res.status === 202 && typeof data.jobRunId === "string") {
        toast(
          typeof data.message === "string" && data.message
            ? data.message
            : "全課批次已開始，請稍候…",
          "info",
        );
        finalData = await pollJobRun(data.jobRunId);
      } else if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "批次處理失敗"));
      }

      await refreshWvp();
      const s = toBatchSummary(finalData, chapters.length);
      if (s.failed && s.failed > 0) {
        playWarningSound();
        toast(
          `已完成 ${s.generated}/${s.total} 章 AI 產生；${s.failed} 章有錯誤（見主控台或重試單章）`,
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
            : "第 1 章試執行已開始，請稍候…",
          "info",
        );
        finalData = await pollJobRun(data.jobRunId);
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
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedThemePreview?.imageUrl ?? themeGalleryFallbackImage}
                  alt={selectedTheme?.nameZh ?? "主題預覽"}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
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
                      配圖請在下方各章「AI 配圖工作室」確認提示詞後生圖；打包階段不再自動生圖。
                    </p>
                  ) : null}
                </div>
                {!anchorOk ? (
                  <div className="mb-3 w-full space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
                    <p className="text-sm font-medium text-emerald-100/90">
                      請先驗收第 1 章風格，確認無誤後才能執行全課「開始執行」。
                    </p>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      系統會依 Checkpoint 素材自動選擇 Hook 或清單揭示模板，無需手動逐一套用。不滿意結果可再次試執行。
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
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
              </CraftWorkflowStep>

            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">章節列表</h3>
              {chapters.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  正常使用上方「開始執行」即可，無需手動逐章操作。
                  若修改了某章文稿，可用「匯入口播」重新同步口播內容，再用「AI 畫面」重新產生該章視覺。
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
                          title="從文稿重新匯入本章口播內容（文稿有修改時用）"
                          className="cf-btn cf-btn-secondary shrink-0 basis-1/4 px-1 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy}
                          onClick={() => syncChapter(ch.wvp_chapter_id)}
                        >
                          {isSyncing ? "…" : "匯入口播"}
                        </button>
                        <button
                          type="button"
                          title="用 AI 重新產生本章視覺動效程式（口播已匯入後才有效果）"
                          className="cf-btn cf-btn-secondary shrink-0 basis-1/4 px-1 py-1 text-center text-[10px] leading-tight"
                          disabled={!!busy || !providers.length}
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
          {chapters.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-zinc-400">章節配圖</h3>
              {chapters.map((ch) => (
                <CraftChapterIllustration
                  key={ch.wvp_chapter_id}
                  projectId={projectId}
                  wvpChapterId={ch.wvp_chapter_id}
                  chapterTitle={ch.title}
                  disabled={locks.craft}
                  onOpenStylePicker={() => setStylePickerOpen(true)}
                />
              ))}
            </div>
          ) : null}

          {chapters.length > 0 ? (
            <div className="space-y-1.5 border-t border-zinc-800 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-400">排版自檢報告</h3>
                <button
                  type="button"
                  className="text-[11px] text-zinc-500 hover:text-zinc-300"
                  onClick={() => void refreshSelfCheck()}
                  title="重新整理自檢報告"
                >
                  ↻ 重新整理
                </button>
              </div>
              <SelfCheckPanel report={selfCheckReport} />
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
