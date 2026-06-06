"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/Toast";

function postToIframe(iframe: HTMLIFrameElement | null, action: string) {
  iframe?.contentWindow?.postMessage({ type: "cf-play-control", action }, "*");
}

function IconFirst() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 6L5 12l6 6M18 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLast() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l6 6-6 6M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCaptions({ off }: { off?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 14h4M13 14h4M7 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {off ? (
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function RoundNavBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-950/80 text-zinc-100 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-zinc-400/90 hover:bg-zinc-800/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function WvpPlayShell({
  projectId,
  projectTitle,
  iframeSrc,
  anchorPreview,
  anchorWvpChapterId,
  chapterPreview,
}: {
  projectId: string;
  projectTitle: string;
  iframeSrc: string;
  /** 第 1 章試跑預覽：僅含第 1 章，並可在此確認風格 */
  anchorPreview?: boolean;
  anchorWvpChapterId?: string;
  /** 視覺動效章節列表的單章試跑預覽 */
  chapterPreview?: boolean;
}) {
  const craftPreview = anchorPreview || chapterPreview;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);
  const [isFirst, setIsFirst] = useState(true);
  const [isLast, setIsLast] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subsOn, setSubsOn] = useState(true);

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const send = useCallback((action: string) => {
    postToIframe(iframeRef.current, action);
  }, []);

  // Listen for cursor updates from the iframe to enable/disable nav buttons.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; globalIndex?: number; totalGlobal?: number };
      if (data?.type !== "cf-cursor") return;
      const { globalIndex = 0, totalGlobal = 1 } = data;
      setIsFirst(globalIndex === 0);
      setIsLast(globalIndex >= totalGlobal - 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        send("space");
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        send("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        send("prev");
      } else if (e.key === "Home") {
        e.preventDefault();
        send("first");
      } else if (e.key === "End") {
        e.preventDefault();
        send("last");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  const approveAnchor = async () => {
    if (!anchorWvpChapterId) return;
    setApproving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wvp/chapters/${anchorWvpChapterId}/approve`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "確認失敗");
      toast("已確認第 1 章風格，可回到視覺動效執行全課", "success");
      router.push(`/projects/${projectId}/craft`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "確認失敗", "error");
    } finally {
      setApproving(false);
    }
  };

  // Header content shared between fullscreen and normal modes
  const headerContent = (
    <>
      <span className="text-xs text-zinc-500">
        {projectTitle} —{" "}
        {anchorPreview ? "第1章試跑預覽" : chapterPreview ? "單章試跑預覽" : "預覽"}
      </span>
      <div className="flex gap-2">
        {craftPreview ? (
          <Link
            href={`/projects/${projectId}/craft`}
            className="cf-btn cf-btn-sm cf-btn-secondary"
          >
            返回「視覺動效」階段
          </Link>
        ) : (
          <>
            <button
              type="button"
              className={`cf-btn cf-btn-sm ${
                subsOn ? "cf-btn-secondary" : "cf-btn-secondary opacity-50"
              }`}
              onClick={() => {
                const next = !subsOn;
                setSubsOn(next);
                postToIframe(iframeRef.current, next ? "subs-on" : "subs-off");
              }}
              aria-pressed={subsOn}
              aria-label={subsOn ? "關閉字幕" : "開啟字幕"}
              title={subsOn ? "關閉字幕" : "開啟字幕"}
            >
              <IconCaptions off={!subsOn} />
            </button>
            <button
              type="button"
              className="cf-btn cf-btn-sm cf-btn-secondary"
              onClick={() => {
                const el = document.documentElement;
                if (!document.fullscreenElement) {
                  void el.requestFullscreen();
                } else {
                  void document.exitFullscreen();
                }
              }}
            >
              全螢幕
            </button>
            <Link
              href={`/projects/${projectId}/wvp-play?auto=1`}
              className="cf-btn cf-btn-sm cf-btn-secondary"
            >
              自動播放
            </Link>
            <Link
              href={`/projects/${projectId}/publish`}
              className="cf-btn cf-btn-sm cf-btn-secondary"
            >
              返回「預覽匯出」階段
            </Link>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {isFullscreen ? (
        /* Fullscreen: 16px 透明感應條固定在頂端（h-4），header 用 absolute top-0
           錨定到 viewport 頂部，-translate-y-full 將其完整推出畫面（y=-36px）。
           group-hover 時 translate-y-0 讓 header 滑入顯示。 */
        <div className="group/hdr pointer-events-none fixed inset-x-0 top-0 z-20 h-4">
          <div className="pointer-events-auto absolute inset-0" />
          <header className="pointer-events-auto absolute inset-x-0 top-0 flex h-9 -translate-y-full items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-3 py-1 backdrop-blur-sm transition-transform duration-300 group-hover/hdr:translate-y-0 focus-within:translate-y-0">
            {headerContent}
          </header>
        </div>
      ) : (
        <header className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-1">
          {headerContent}
        </header>
      )}
      <div className={`relative flex min-h-0 items-stretch ${isFullscreen ? "flex-1" : "flex-1"}`}>
        {/* Left nav — in fullscreen: hidden until hover at left edge */}
        <nav
          className={
            isFullscreen
              ? "pointer-events-none absolute inset-y-0 left-0 z-10 flex w-24 items-center pl-3 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100"
              : "pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3"
          }
          aria-label="簡報換頁（左）"
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <RoundNavBtn label="第一頁" onClick={() => send("first")} disabled={isFirst}>
              <IconFirst />
            </RoundNavBtn>
            <RoundNavBtn label="前一頁" onClick={() => send("prev")} disabled={isFirst}>
              <IconPrev />
            </RoundNavBtn>
          </div>
        </nav>
        <iframe
          ref={iframeRef}
          title="WVP presentation"
          src={iframeSrc}
          className="h-full min-w-0 flex-1 border-0 bg-black"
          allow="autoplay"
        />
        {/* Right nav — in fullscreen: hidden until hover at right edge */}
        <nav
          className={
            isFullscreen
              ? "pointer-events-none absolute inset-y-0 right-0 z-10 flex w-24 items-center justify-end pr-3 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100"
              : "pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3"
          }
          aria-label="簡報換頁（右）"
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <RoundNavBtn label="後一頁" onClick={() => send("next")} disabled={isLast}>
              <IconNext />
            </RoundNavBtn>
            <RoundNavBtn label="最後一頁" onClick={() => send("last")} disabled={isLast}>
              <IconLast />
            </RoundNavBtn>
          </div>
        </nav>
      </div>
      {anchorPreview ? (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3">
          <p className="text-xs text-zinc-400">
            此預覽僅含第 1 章。確認風格無誤後，即可在視覺動效頁面執行全課「開始執行」。
          </p>
          <button
            type="button"
            className="cf-btn cf-btn-sm shrink-0 bg-emerald-800 text-white hover:bg-emerald-700"
            disabled={approving || !anchorWvpChapterId}
            onClick={() => void approveAnchor()}
          >
            {approving ? "處理中…" : "已確認第 1 章風格"}
          </button>
        </footer>
      ) : chapterPreview ? (
        <footer className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-2.5">
          <p className="text-xs text-zinc-400">
            此預覽僅含單一章節（視覺動效試跑，不含語音）。測試完成後請回到「視覺動效」繼續編輯或執行全課。
          </p>
        </footer>
      ) : null}
    </div>
  );
}
