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

function RoundNavBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-950/80 text-zinc-100 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-zinc-400/90 hover:bg-zinc-800/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
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
}: {
  projectId: string;
  projectTitle: string;
  iframeSrc: string;
  /** 第 1 章試跑預覽：僅含第 1 章，並可在此確認風格 */
  anchorPreview?: boolean;
  anchorWvpChapterId?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);

  const send = useCallback((action: string) => {
    postToIframe(iframeRef.current, action);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-1">
        <span className="text-xs text-zinc-500">
          {projectTitle} — {anchorPreview ? "第1章試跑預覽" : "預覽"}
        </span>
        <div className="flex gap-2">
          {anchorPreview ? (
            <Link
              href={`/projects/${projectId}/craft`}
              className="cf-btn cf-btn-sm cf-btn-secondary"
            >
              返回「視覺動效」階段
            </Link>
          ) : (
            <>
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
      </header>
      <div className="relative flex min-h-0 flex-1 items-stretch">
        <nav
          className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3"
          aria-label="簡報換頁（左）"
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <RoundNavBtn label="第一頁" onClick={() => send("first")}>
              <IconFirst />
            </RoundNavBtn>
            <RoundNavBtn label="前一頁" onClick={() => send("prev")}>
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
        <nav
          className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3"
          aria-label="簡報換頁（右）"
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <RoundNavBtn label="後一頁" onClick={() => send("next")}>
              <IconNext />
            </RoundNavBtn>
            <RoundNavBtn label="最後一頁" onClick={() => send("last")}>
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
      ) : null}
    </div>
  );
}
