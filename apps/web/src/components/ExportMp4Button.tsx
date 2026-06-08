"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/Toast";
import { LottieMark } from "@/components/lottie/LottieMark";
import { AnimatePresence, motion } from "framer-motion";
import { useUiMotion } from "@/components/motion/presets";

type ExportStatus = "idle" | "pending" | "processing" | "completed" | "failed";

function renderProgressLabel(
  progress: number,
  quickDraft: boolean,
  pipeline?: string,
): string {
  if (pipeline === "wvp") {
    if (progress < 45) return "準備匯出…";
    if (progress < 88) return "轉檔匯出中…";
    if (progress < 100) return "上傳影片…";
    return "完成";
  }
  if (progress < 15) return "準備中…";
  if (progress < 30) return "下載素材…";
  if (progress < 40) return "編譯場景…";
  if (progress < 85) {
    return quickDraft
      ? "快速渲染中（通常較快）…"
      : "渲染影片中（可能較久）…";
  }
  if (progress < 100) return "上傳影片…";
  return "完成";
}

export function ExportMp4Button({
  projectId,
  className,
  buttonClassName,
  compact = false,
}: {
  projectId: string;
  className?: string;
  buttonClassName?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const { fadeSlide } = useUiMotion();
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [quickDraft, setQuickDraft] = useState(false);
  const [pipeline, setPipeline] = useState<string | undefined>();
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickDraftRef = useRef(quickDraft);
  const pipelineRef = useRef(pipeline);

  useEffect(() => {
    quickDraftRef.current = quickDraft;
  }, [quickDraft]);

  useEffect(() => {
    pipelineRef.current = pipeline;
  }, [pipeline]);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/export/latest`)
      .then((r) => r.json())
      .then((data: { downloadUrl?: string | null }) => {
        if (cancelled || !data.downloadUrl) return;
        setDownloadUrl(data.downloadUrl);
        setStatus("completed");
        setStatusMessage("MP4 已就緒");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const poll = useCallback(
    async (jobId: string) => {
      const res = await fetch(`/api/render-jobs/${jobId}`);
      const data = await res.json();
      const jobStatus = (data.job?.status ?? "") as ExportStatus;

      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        setStatus("completed");
        setStatusMessage("MP4 已就緒");
        toast("MP4 渲染完成，可以下載了", "success", { taskComplete: true });
        return;
      }

      if (jobStatus === "failed") {
        setStatus("failed");
        setStatusMessage(data.job?.error_message ?? "渲染失敗");
        toast(data.job?.error_message ?? "渲染失敗", "error");
        return;
      }

      if (jobStatus === "processing") {
        const pct = data.job?.progress ?? 0;
        setStatus("processing");
        setStatusMessage(
          `${renderProgressLabel(pct, quickDraftRef.current, pipelineRef.current)} ${pct}%`,
        );
      } else if (jobStatus === "pending") {
        setStatus("pending");
        setStatusMessage("排隊中…");
      }

      if (jobStatus === "processing" || jobStatus === "pending") {
        pollRef.current = setTimeout(() => poll(jobId), 3000);
      }
    },
    [toast],
  );

  const startExport = async () => {
    clearPoll();
    setStatus("pending");
    setStatusMessage("檢查匯出條件…");
    setDownloadUrl(null);
    setPipeline(undefined);

    const readyRes = await fetch(`/api/projects/${projectId}/wvp/export-readiness`);
    const readyData = await readyRes.json();
    if (readyRes.ok && readyData.ready === false) {
      const msg =
        (readyData.blockers as string[])?.join("；") ?? "尚未符合 WVP 匯出條件";
      setStatus("failed");
      setStatusMessage(msg);
      toast(msg, "error");
      return;
    }

    setStatusMessage("啟動中…");
    const res = await fetch(`/api/projects/${projectId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "export",
        quality: quickDraft ? "draft" : "standard",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("failed");
      setStatusMessage(data.error ?? "無法開始渲染");
      toast(data.error ?? "無法開始渲染", "error");
      return;
    }

    setPipeline(data.pipeline as string | undefined);
    setStatusMessage(
      data.pipeline === "wvp"
        ? "匯出已加入佇列…"
        : data.inline
          ? "轉檔匯出中…"
          : "已加入佇列…",
    );
    if (data.inline && data.renderJob?.id) {
      poll(data.renderJob.id);
      return;
    }
    poll(data.renderJob.id);
  };

  const busy = status === "pending" || status === "processing";

  const statusTone =
    status === "failed"
      ? "text-red-900/90 dark:text-red-400/95"
      : status === "completed"
        ? "text-emerald-600/90"
        : statusMessage
          ? "text-amber-400"
          : "";

  return (
    <div className={cn("inline-flex min-w-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1.5 text-sm text-zinc-400",
            compact && "text-xs text-white/80",
          )}
          title="以較低畫質快速匯出，適合先確認流程"
        >
          <input
            type="checkbox"
            checked={quickDraft}
            disabled={busy}
            onChange={(e) => setQuickDraft(e.target.checked)}
            className="rounded border-zinc-600"
          />
          快速匯出（畫質較低）
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={startExport}
          className={cn(
            compact ? "play-page-btn play-page-btn-accent" : "cf-btn cf-btn-sm cf-btn-secondary",
            busy && "opacity-60",
            buttonClassName,
          )}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <LottieMark variant="loading" size={16} ariaLabel="匯出中" />
              <span>匯出中…</span>
            </span>
          ) : (
            "匯出為 MP4 影片"
          )}
        </button>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download
            className={cn(
              compact ? "play-page-btn" : "cf-btn cf-btn-sm cf-btn-primary",
            )}
          >
            下載
          </a>
        ) : null}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {statusMessage ? (
          <motion.p
            key={statusMessage}
            variants={fadeSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            role="status"
            className={cn(
              "w-full text-sm leading-relaxed",
              statusTone,
              compact && "text-xs",
            )}
          >
            {statusMessage}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
