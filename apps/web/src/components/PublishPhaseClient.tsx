"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CourseComposition, WvpPhaseLocks } from "@courseflow/core";
import { WvpPhaseBottomActions, WvpPhaseNav } from "@/components/ProjectPhaseNav";
import { ExportMp4Button } from "@/components/ExportMp4Button";
import { useToast } from "@/components/Toast";
import {
  isBrowserNotifyEnabled,
  requestBrowserNotifyPermission,
  setBrowserNotifyEnabled,
} from "@/lib/browser-notify";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import { FullWidthProgressPanel } from "@/components/FullWidthProgressPanel";
import { useElapsedMs } from "@/hooks/useElapsedMs";
import {
  blendWvpBuildPercent,
  createInitialWvpBuildProgress,
  estimateWvpBuildRemainingMs,
  formatWvpBuildProgressLabel,
  parseWvpBuildProgress,
  type WvpBuildProgress,
} from "@/lib/wvp-build-progress";
import { stepCountForChapter } from "@/lib/wvp-chapters";
import { titleToWvpChapterId } from "@/lib/wvp-slug";

function resolveCompositionChapterForCraft(
  composition: CourseComposition,
  craft: { title: string; wvp_chapter_id: string; sort_order?: number },
) {
  const normalizedTitle = craft.title.trim();
  const byExactTitle = composition.chapters.find((c) => c.title.trim() === normalizedTitle);
  if (byExactTitle) return byExactTitle;

  const rootChapters = composition.chapters
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const byWvpId = rootChapters.find(
    (ch, index) => titleToWvpChapterId(ch.title, index) === craft.wvp_chapter_id,
  );
  if (byWvpId) return byWvpId;

  if (typeof craft.sort_order === "number" && craft.sort_order >= 0) {
    return rootChapters[craft.sort_order] ?? null;
  }
  return null;
}

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  craft_status: string;
  step_count: number;
  sort_order: number;
};

type ExportReadiness = {
  ready?: boolean;
  allChecklistOk?: boolean;
  blockers?: string[];
  chapters?: {
    wvpChapterId?: string;
    title: string;
    checklistOk: boolean;
    checklistSkipped?: boolean;
    failedItems?: string[];
  }[];
};

type MotionPlanSummary = {
  totalSteps: number;
  explainStepCount: number;
  fallbackStepCount: number;
  noneStepCount: number;
  craftAnimationStepCount: number;
  warnings: string[];
  chapters: Array<{
    title: string;
    totalSteps: number;
    explainStepCount: number;
    fallbackStepCount: number;
    orientation: string;
    warnings: string[];
  }>;
};

export function PublishPhaseClient({
  projectId,
  initialLocks,
  initialComposition,
  initialPreviewBuilt = false,
  chapters,
}: {
  projectId: string;
  initialLocks: WvpPhaseLocks;
  initialComposition: CourseComposition;
  initialPreviewBuilt?: boolean;
  chapters: CraftRow[];
}) {
  const [locks, setLocks] = useState(initialLocks);
  const [composition, setComposition] = useState(initialComposition);
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [motionPlan, setMotionPlan] = useState<MotionPlanSummary | null>(null);
  const [previewBuilt, setPreviewBuilt] = useState(initialPreviewBuilt);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<WvpBuildProgress | null>(null);
  const [buildQueueHint, setBuildQueueHint] = useState<string | null>(null);
  const [skippingChapterId, setSkippingChapterId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [browserNotifyOn, setBrowserNotifyOn] = useState(false);
  const [buildLastError, setBuildLastError] = useState<string | null>(null);
  const buildElapsedMs = useElapsedMs(building);
  const { toast } = useToast();
  const locked = locks.publish;

  const audioGate = useMemo(() => evaluateWvpAudioBuildGate(composition), [composition]);

  const refreshReadiness = useCallback(async () => {
    const [readinessRes, motionRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/wvp/export-readiness?_=${Date.now()}`, {
        cache: "no-store",
      }),
      fetch(`/api/projects/${projectId}/wvp/motion-plan?_=${Date.now()}`, {
        cache: "no-store",
      }),
    ]);
    if (!readinessRes.ok) {
      setReadiness(null);
    } else {
      setReadiness((await readinessRes.json()) as ExportReadiness);
    }
    if (!motionRes.ok) {
      setMotionPlan(null);
    } else {
      const data = (await motionRes.json()) as { plan?: MotionPlanSummary };
      setMotionPlan(data.plan ?? null);
    }
  }, [projectId]);

  useEffect(() => {
    refreshReadiness().catch(() => setReadiness(null));
  }, [refreshReadiness]);

  useEffect(() => {
    setBrowserNotifyOn(isBrowserNotifyEnabled());
    fetch(`/api/projects/${projectId}/share`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.shareUrl) setShareUrl(d.shareUrl as string);
      })
      .catch(() => undefined);
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.composition) setComposition(d.composition);
      })
      .catch(() => undefined);
  }, [projectId]);

  const POLL_INTERVAL_MS = 2000;
  const POLL_MAX_ATTEMPTS = 600;

  const pollWvpBuildJob = async (jobRunId: string, attempt = 0): Promise<void> => {
    let res: Response;
    let data: {
      error?: string;
      job?: {
        status?: string;
        error_message?: string | null;
        result?: Record<string, unknown>;
      };
    } = {};

    try {
      res = await fetch(`/api/job-runs/${jobRunId}`);
      const text = await res.text();
      if (text.trim()) {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          data = parsed as typeof data;
        }
      }
    } catch {
      if (attempt >= POLL_MAX_ATTEMPTS) {
        throw new Error("打包狀態查詢逾時，請稍後重新整理頁面確認結果");
      }
      await new Promise((r) => window.setTimeout(r, POLL_INTERVAL_MS));
      return pollWvpBuildJob(jobRunId, attempt + 1);
    }

    if (!res.ok) {
      if ([502, 503, 504].includes(res.status) && attempt < POLL_MAX_ATTEMPTS) {
        await new Promise((r) => window.setTimeout(r, POLL_INTERVAL_MS));
        return pollWvpBuildJob(jobRunId, attempt + 1);
      }
      throw new Error(data.error ?? "無法查詢打包狀態");
    }

    const status = data.job?.status;
    const result = data.job?.result;

    if (status === "pending") {
      setBuildQueueHint("打包任務排隊中…");
      const progress = parseWvpBuildProgress(result);
      if (progress) setBuildProgress(progress);
    } else if (status === "running") {
      setBuildQueueHint(null);
      const progress = parseWvpBuildProgress(result);
      if (progress) setBuildProgress(progress);
    }

    if (status === "completed") {
      const doneProgress = parseWvpBuildProgress(result);
      if (doneProgress) setBuildProgress(doneProgress);
      setPreviewBuilt(true);
      const completed = result as { warning?: string; storageUploaded?: boolean } | undefined;
      if (completed?.warning && !completed.storageUploaded) {
        toast(`預覽已打包；雲端上傳略過：${completed.warning}`, "info");
      } else {
        toast("課程預覽已打包（含語音），可開啟播放", "success", { taskComplete: true });
      }
      window.open(`/projects/${projectId}/wvp-play`, "_blank", "noopener,noreferrer");
      return;
    }
    if (status === "failed") {
      const failedProgress = parseWvpBuildProgress(result);
      if (failedProgress) setBuildProgress(failedProgress);
      const err =
        failedProgress?.lastError ??
        data.job?.error_message ??
        "打包失敗";
      setBuildLastError(err);
      throw new Error(err);
    }

    if (attempt >= POLL_MAX_ATTEMPTS) {
      throw new Error(
        "前端輪詢已達 20 分鐘。打包可能仍在背景執行，請重新整理頁面後試開「播放預覽」；若仍失敗請至 Render 查看 Web 服務日誌（Free 512MB 常見記憶體不足）。",
      );
    }

    await new Promise((r) => window.setTimeout(r, POLL_INTERVAL_MS));
    return pollWvpBuildJob(jobRunId, attempt + 1);
  };

  const buildWvpPreview = async () => {
    if (!audioGate.ready) {
      toast(audioGate.message ?? "請先完成語音合成", "error");
      return;
    }
    setBuilding(true);
    setBuildLastError(null);
    setBuildQueueHint("正在啟動打包任務…");
    const rootChapterCount = composition.chapters.filter((ch) => !ch.parentId).length;
    setBuildProgress(createInitialWvpBuildProgress(rootChapterCount));
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId: composition.meta.themeId ?? undefined,
        }),
      });
      const text = await res.text();
      let data: {
        error?: string;
        warning?: string;
        storageUploaded?: boolean;
        chaptersVisualUpgraded?: string[];
        queued?: boolean;
        jobRunId?: string;
        message?: string;
      } = {};
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        const hint =
          res.status === 502 || res.status === 504
            ? "伺服器逾時（雲端打包需數分鐘）。請確認已部署最新版並稍後重試。"
            : res.status >= 500
              ? "伺服器錯誤，請稍後再試或查看部署日誌。"
              : "請確認本機已執行 pnpm dev，且 @courseflow/presentation 已編譯。";
        throw new Error(`建置失敗（HTTP ${res.status}）。${hint}`);
      }
      if (res.status === 202 && data.jobRunId) {
        toast(data.message ?? "課程打包已開始，請稍候…", "info");
        await pollWvpBuildJob(data.jobRunId);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "建置失敗");
      setPreviewBuilt(true);
      if (data.warning && !data.storageUploaded) {
        toast(`預覽已打包；雲端上傳略過：${data.warning}`, "info");
      } else {
        toast("課程預覽已打包（含語音），可開啟播放", "success", { taskComplete: true });
      }
      window.open(`/projects/${projectId}/wvp-play`, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast(e instanceof Error ? e.message : "建置失敗", "error");
    } finally {
      setBuilding(false);
      setBuildQueueHint(null);
    }
  };

  const buildProgressLabel = useMemo(() => {
    if (buildProgress) return formatWvpBuildProgressLabel(buildProgress);
    if (building) return "啟動打包…";
    return "正在打包…";
  }, [buildProgress, building]);

  const buildProgressPercent = useMemo(
    () => blendWvpBuildPercent(buildProgress, buildElapsedMs),
    [buildProgress, buildElapsedMs],
  );

  const chapterStatuses = useMemo(() => {
    type ReadinessChapter = NonNullable<ExportReadiness["chapters"]>[number] & {
      wvp_chapter_id?: string;
    };

    const rows: ReadinessChapter[] =
      readiness?.chapters ??
      chapters.map((ch) => ({
        wvpChapterId: ch.wvp_chapter_id,
        title: ch.title,
        checklistOk: ch.craft_status === "approved",
        checklistSkipped: false,
        failedItems: [] as string[],
      }));

    return rows.map((ch) => {
      const row = chapters.find(
        (c) =>
          c.title === ch.title ||
          (ch.wvpChapterId && c.wvp_chapter_id === ch.wvpChapterId) ||
          (ch.wvp_chapter_id && c.wvp_chapter_id === ch.wvp_chapter_id),
      );
      const status = row?.craft_status ?? "—";
      const compChapter = row
        ? resolveCompositionChapterForCraft(composition, {
            title: row.title,
            wvp_chapter_id: row.wvp_chapter_id,
            sort_order: row.sort_order,
          })
        : null;
      const steps = compChapter
        ? stepCountForChapter(composition, compChapter.id)
        : row?.step_count ?? 0;
      const checklistSkipped = !!ch.checklistSkipped;
      const checklistOk = ch.checklistOk ?? status === "approved";
      const failedItems = ch.failedItems?.length ? ch.failedItems : [];
      const wvpChapterId =
        ch.wvpChapterId ?? ch.wvp_chapter_id ?? row?.wvp_chapter_id ?? "";
      return {
        key: wvpChapterId || ch.title,
        wvpChapterId,
        title: ch.title,
        status,
        steps,
        checklistOk,
        checklistSkipped,
        failedItems,
      };
    });
  }, [readiness?.chapters, chapters, composition]);

  const failedChapterCount = chapterStatuses.filter(
    (c) => !c.checklistOk && !c.checklistSkipped,
  ).length;
  const checklistBlocker =
    failedChapterCount > 0
      ? (readiness?.blockers?.find((b) => b.includes("視覺自檢")) ??
        `尚有 ${failedChapterCount} 章未通過視覺自檢，建議在「視覺動效」重做後再匯出正式成片。`)
      : null;
  const craftHref = `/projects/${projectId}/craft`;

  const skipChapterChecklist = async (wvpChapterId: string, title: string) => {
    if (!wvpChapterId) {
      toast("無法略過：缺少章節識別碼，請重新整理頁面", "error");
      return;
    }
    const ok = window.confirm(
      `確定要略過「${title}」的視覺自檢結果？\n\n略過後狀態將標示為「略過自檢結果」，匯出 MP4 時不再因此章節阻擋（建議仍於視覺動效修正後再匯出正式成片）。`,
    );
    if (!ok) return;
    setSkippingChapterId(wvpChapterId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${encodeURIComponent(wvpChapterId)}/skip-checklist`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "略過失敗");
      toast(`已略過「${title}」的視覺自檢`, "success");
      await refreshReadiness();
    } catch (e) {
      toast(e instanceof Error ? e.message : "略過失敗", "error");
    } finally {
      setSkippingChapterId(null);
    }
  };

  const createShareLink = async () => {
    setShareBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
      const data = (await res.json()) as { error?: string; shareUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "產生分享連結失敗");
      if (!data.shareUrl) throw new Error("未取得分享網址");
      setShareUrl(data.shareUrl);
      await navigator.clipboard.writeText(data.shareUrl);
      toast("已複製學員觀看連結（含自動播放）", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "產生分享連結失敗", "error");
    } finally {
      setShareBusy(false);
    }
  };

  const toggleBrowserNotify = async () => {
    if (!browserNotifyOn) {
      const perm = await requestBrowserNotifyPermission();
      if (perm !== "granted") {
        toast("瀏覽器未允許桌面通知", "warning");
        return;
      }
      setBrowserNotifyEnabled(true);
      setBrowserNotifyOn(true);
      toast("已啟用桌面通知（分頁在背景時也會提醒）", "success");
      return;
    }
    setBrowserNotifyEnabled(false);
    setBrowserNotifyOn(false);
    toast("已關閉桌面通知", "info");
  };

  const skipAllFailedChecklists = async () => {
    if (failedChapterCount <= 0) {
      toast("目前沒有需要略過的章節", "info");
      return;
    }
    const ok = window.confirm(
      `確定略過 ${failedChapterCount} 個未通過章節的視覺自檢？\n\n匯出 MP4 將不再因此被阻擋。`,
    );
    if (!ok) return;
    setSkippingChapterId("__all__");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/skip-failed-checklists`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        error?: string;
        skippedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "略過失敗");
      const n = data.skippedCount ?? failedChapterCount;
      toast(n > 0 ? `已略過 ${n} 章的視覺自檢` : "沒有章節需要略過", n > 0 ? "success" : "info");
      await refreshReadiness();
    } catch (e) {
      toast(e instanceof Error ? e.message : "略過失敗", "error");
    } finally {
      setSkippingChapterId(null);
    }
  };

  return (
    <div className="space-y-6">
      <WvpPhaseNav projectId={projectId} current="publish" locks={locks} onLocksChange={setLocks} />

      <section className="cf-card cf-card-padded space-y-4">
        <h2 className="cf-section-title">打包、預覽與匯出</h2>
        <p
          className={`text-xs ${audioGate.ready ? "text-emerald-600/90" : "text-amber-500/90"}`}
          role="status"
        >
          語音進度：{audioGate.synthesizedSteps}/{audioGate.totalSteps} 步
          {audioGate.ready ? "（可打包）" : "（請先完成「3. 語音生成」）"}
        </p>
        <div className="space-y-1 text-xs text-zinc-500">
          <p>打包：將文稿、視覺動效與語音編譯成可播放課程（須先完成全部語音）。</p>
          <p>預覽：打包完成後可手動播放預覽或自動播放預覽。</p>
          <p>匯出：匯出影片成品（可勾選）。</p>
        </div>
        {motionPlan ? (
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs">
            <p className="font-medium text-zinc-300">打包前動效檢查</p>
            <p className="mt-1 text-zinc-500">
              全課 {motionPlan.totalSteps} 步 · 預計解說動效 {motionPlan.explainStepCount} 步 ·
              僅進場 fallback {motionPlan.fallbackStepCount} 步 · 無解說 {motionPlan.noneStepCount}{" "}
              步
              {motionPlan.craftAnimationStepCount > 0
                ? ` · 手動解說動畫 ${motionPlan.craftAnimationStepCount} 步`
                : ""}
            </p>
            {motionPlan.warnings.length > 0 ? (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-amber-500/90">
                {motionPlan.warnings.slice(0, 12).map((w) => (
                  <li key={w}>• {w}</li>
                ))}
                {motionPlan.warnings.length > 12 ? (
                  <li>…另有 {motionPlan.warnings.length - 12} 則提示</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1 text-emerald-500/90">取向與內容大致吻合，無明顯衝突。</p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            className="cf-btn cf-btn-primary"
            disabled={locked || building || !audioGate.ready}
            onClick={buildWvpPreview}
            title={audioGate.message ?? undefined}
          >
            {building ? "打包中…" : "打包課程"}
          </button>
          {previewBuilt ? (
            <Link
              href={`/projects/${projectId}/wvp-play`}
              className="cf-btn cf-btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              手動播放預覽
            </Link>
          ) : (
            <span
              className="cf-btn cf-btn-secondary cursor-not-allowed opacity-50"
              title="請先打包"
            >
              手動播放預覽
            </span>
          )}
          {previewBuilt ? (
            <Link
              href={`/projects/${projectId}/wvp-play?auto=1`}
              className="cf-btn cf-btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              自動播放預覽
            </Link>
          ) : (
            <span
              className="cf-btn cf-btn-secondary cursor-not-allowed opacity-50"
              title="請先打包"
            >
              自動播放預覽
            </span>
          )}
          <ExportMp4Button projectId={projectId} />
          {previewBuilt ? (
            <button
              type="button"
              className="cf-btn cf-btn-secondary"
              disabled={locked || shareBusy}
              onClick={() => void createShareLink()}
              title="產生免登入觀看連結，學員開啟後自動播放"
            >
              {shareBusy ? "產生中…" : "一鍵產生分享連結"}
            </button>
          ) : null}
        </div>
        {shareUrl ? (
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-xs">
            <p className="text-zinc-400">學員觀看連結（免登入 · 自動播放）</p>
            <p className="mt-1 break-all font-mono text-[11px] text-emerald-500/90">{shareUrl}</p>
            <button
              type="button"
              className="mt-2 text-[11px] text-zinc-500 underline hover:text-zinc-300"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                toast("已複製分享連結", "success");
              }}
            >
              複製連結
            </button>
          </div>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={browserNotifyOn}
            onChange={() => void toggleBrowserNotify()}
          />
          長任務完成或失敗時發送瀏覽器通知（分頁在背景也會提醒）
        </label>
        {buildLastError ? (
          <p className="rounded border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300/90">
            打包失敗：{buildLastError}
          </p>
        ) : null}
        <FullWidthProgressPanel
          busy={building}
          label={buildProgressLabel}
          percent={buildProgressPercent}
          eta={buildProgress ? estimateWvpBuildRemainingMs(buildProgress) : null}
          queueHint={buildQueueHint}
        />
      </section>

      <section className="cf-card cf-card-padded space-y-4">
        <h2 className="cf-section-title">自檢結果</h2>

        {checklistBlocker ? (
          <div
            className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200/90"
            role="status"
          >
            <p>{checklistBlocker}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={craftHref}
                className="inline-flex items-center text-[var(--accent)] hover:underline"
              >
                前往視覺動效重做（{failedChapterCount} 章未通過）→
              </Link>
              <button
                type="button"
                className="text-sm text-lime-400/95 hover:text-lime-300 hover:underline disabled:opacity-50"
                disabled={skippingChapterId !== null}
                onClick={() => skipAllFailedChecklists()}
              >
                {skippingChapterId === "__all__"
                  ? "略過中…"
                  : "略過全部未通過自檢"}
              </button>
            </div>
          </div>
        ) : null}

        <ul className="divide-y divide-zinc-800/80 text-sm text-zinc-400">
          {chapterStatuses.map((ch) => (
            <li
              key={ch.key}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
            >
              <span className="min-w-0 flex-1">
                {ch.title} — {ch.status}（{ch.steps} 步）
                {ch.checklistSkipped ? (
                  <span className="text-lime-500/90"> · 略過自檢結果</span>
                ) : ch.checklistOk ? (
                  <span className="text-emerald-600/90"> · 自檢通過</span>
                ) : (
                  <span className="text-amber-500/90"> · 自檢未過</span>
                )}
                {ch.failedItems.length ? `（${ch.failedItems.join("、")}）` : ""}
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
                {!ch.checklistOk && !ch.checklistSkipped && ch.wvpChapterId ? (
                  <>
                    <button
                      type="button"
                      className="text-xs text-lime-500/90 hover:text-lime-400 hover:underline disabled:opacity-50"
                      disabled={skippingChapterId !== null}
                      onClick={() => skipChapterChecklist(ch.wvpChapterId, ch.title)}
                    >
                      {skippingChapterId === ch.wvpChapterId
                        ? "略過中…"
                        : "略過自檢結果"}
                    </button>
                    <Link
                      href={craftHref}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      前往重做
                    </Link>
                  </>
                ) : !ch.checklistOk ? (
                  <Link
                    href={craftHref}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    前往視覺動效重做
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <WvpPhaseBottomActions
        projectId={projectId}
        phase="publish"
        locks={locks}
        onUnlock={async () => {
          const res = await fetch(`/api/projects/${projectId}/wvp/phases/publish/lock`, {
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
