"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CourseComposition, WvpPhaseLocks } from "@courseflow/core";
import { WvpPhaseBottomActions, WvpPhaseNav } from "@/components/ProjectPhaseNav";
import { ExportMp4Button } from "@/components/ExportMp4Button";
import { useToast } from "@/components/Toast";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  craft_status: string;
  step_count: number;
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
  const [previewBuilt, setPreviewBuilt] = useState(initialPreviewBuilt);
  const [building, setBuilding] = useState(false);
  const [buildElapsedSec, setBuildElapsedSec] = useState(0);
  const [skippingChapterId, setSkippingChapterId] = useState<string | null>(null);
  const { toast } = useToast();
  const locked = locks.publish;

  const audioGate = useMemo(() => evaluateWvpAudioBuildGate(composition), [composition]);

  const refreshReadiness = useCallback(async () => {
    const r = await fetch(
      `/api/projects/${projectId}/wvp/export-readiness?_=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!r.ok) {
      setReadiness(null);
      return;
    }
    setReadiness((await r.json()) as ExportReadiness);
  }, [projectId]);

  useEffect(() => {
    refreshReadiness().catch(() => setReadiness(null));
  }, [refreshReadiness]);

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
    setBuildElapsedSec(attempt * (POLL_INTERVAL_MS / 1000));
    const res = await fetch(`/api/job-runs/${jobRunId}`);
    const data = (await res.json()) as {
      error?: string;
      job?: {
        status?: string;
        error_message?: string | null;
        result?: {
          warning?: string;
          storageUploaded?: boolean;
        };
      };
    };
    if (!res.ok) {
      throw new Error(data.error ?? "無法查詢打包狀態");
    }

    const status = data.job?.status;
    if (status === "completed") {
      const result = data.job?.result;
      setPreviewBuilt(true);
      if (result?.warning && !result.storageUploaded) {
        toast(`預覽已打包；雲端上傳略過：${result.warning}`, "info");
      } else {
        toast("課程預覽已打包（含語音），可開啟播放", "success", { taskComplete: true });
      }
      window.open(`/projects/${projectId}/wvp-play`, "_blank", "noopener,noreferrer");
      return;
    }
    if (status === "failed") {
      throw new Error(data.job?.error_message ?? "打包失敗");
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
    setBuildElapsedSec(0);
    try {
      const res = await fetch(`/api/projects/${projectId}/wvp/build`, { method: "POST" });
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
    }
  };

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
      const steps = row?.step_count ?? 0;
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
  }, [readiness?.chapters, chapters]);

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

      <section className="cf-card cf-card-padded space-y-3">
        <h2 className="cf-section-title">打包與預覽</h2>
        <p
          className={`text-xs ${audioGate.ready ? "text-emerald-600/90" : "text-amber-500/90"}`}
          role="status"
        >
          語音進度：{audioGate.synthesizedSteps}/{audioGate.totalSteps} 步
          {audioGate.ready ? "（可打包）" : "（請先完成「3. 語音生成」）"}
        </p>
        <p className="text-xs text-zinc-500">
          將文稿內容、視覺動效與口播語音檔編譯成可播放的網頁課程，編譯之前須先完成全部語音生成。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="cf-btn cf-btn-primary"
            disabled={locked || building || !audioGate.ready}
            onClick={buildWvpPreview}
            title={audioGate.message ?? undefined}
          >
            {building
              ? buildElapsedSec >= 60
                ? `打包中（已 ${Math.floor(buildElapsedSec / 60)} 分 ${buildElapsedSec % 60} 秒）…`
                : buildElapsedSec > 0
                  ? `打包中（已 ${buildElapsedSec} 秒）…`
                  : "打包中（首次較久）…"
              : "打包課程"}
          </button>
          {previewBuilt ? (
            <Link
              href={`/projects/${projectId}/wvp-play`}
              className="cf-btn cf-btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              開啟預覽播放
            </Link>
          ) : (
            <span
              className="cf-btn cf-btn-secondary cursor-not-allowed opacity-50"
              title="請先打包"
            >
              開啟預覽播放
            </span>
          )}
          <Link href={`/projects/${projectId}/audio`} className="cf-btn cf-btn-secondary">
            ← 語音生成
          </Link>
        </div>
      </section>

      <section className="cf-card cf-card-padded space-y-4">
        <h2 className="cf-section-title">預覽與匯出</h2>
        <p className="text-sm text-zinc-500">
          完成上方打包後可互動預覽。MP4 匯出使用與預覽相同的 WVP build + Playwright（?auto=1）；需本機
          ffmpeg（轉 webm→mp4）。
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href={`/projects/${projectId}/wvp-play`} className="cf-btn cf-btn-primary">
            互動預覽
          </Link>
          <Link
            href={`/projects/${projectId}/wvp-play?auto=1`}
            className="cf-btn cf-btn-secondary"
          >
            自動播放預覽
          </Link>
          <ExportMp4Button projectId={projectId} />
        </div>

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
                {ch.title} — {ch.status} ({ch.steps} steps)
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
