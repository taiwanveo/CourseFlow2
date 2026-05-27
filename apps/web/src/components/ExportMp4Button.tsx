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
    if (progress < 30) return "準備 WVP 簡報…";
    if (progress < 55) return "Playwright 錄製中（?auto=1）…";
    if (progress < 85) return "轉檔 / 上傳 MP4…";
    if (progress < 100) return "完成中…";
    return "完成";
  }
  if (progress < 15) return "準備中…";
  if (progress < 30) return "下載素材…";
  if (progress < 40) return "編譯場景…";
  if (progress < 85) {
    return quickDraft
      ? "快速渲染中（draft，通常較快）…"
      : "渲染影片中（HyperFrames，可能較久）…";
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
        ? "WVP 錄製已加入佇列…"
        : data.inline
          ? "WVP 內嵌錄製中…"
          : "已加入佇列…",
    );
    if (data.inline && data.renderJob?.id) {
      poll(data.renderJob.id);
      return;
    }
    poll(data.renderJob.id);
  };

  const busy = status === "pending" || status === "processing";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-1.5 text-sm text-zinc-400",
          compact && "text-xs text-white/80",
        )}
        title="使用 HyperFrames draft 品質，渲染較快、暫存占用較少，適合先確認流程"
      >
        <input
          type="checkbox"
          checked={quickDraft}
          disabled={busy}
          onChange={(e) => setQuickDraft(e.target.checked)}
          className="rounded border-zinc-600"
        />
        快速匯出（draft）
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
        ) : quickDraft ? (
          "快速匯出"
        ) : (
          "匯出"
        )}
      </button>
      <AnimatePresence mode="popLayout" initial={false}>
        {statusMessage ? (
          <motion.span
            key={statusMessage}
            variants={fadeSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn(
              "text-sm",
              status === "failed" ? "text-red-400" : "text-zinc-400",
              compact && "text-xs text-white/80",
            )}
          >
            {statusMessage}
          </motion.span>
        ) : null}
      </AnimatePresence>
      {downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className={cn(
            compact ? "play-page-btn" : "cf-btn cf-btn-sm cf-btn-primary",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <LottieMark variant="success" size={16} ariaLabel="完成" loop={false} />
            <span>下載</span>
          </span>
        </a>
      ) : null}
    </div>
  );
}
