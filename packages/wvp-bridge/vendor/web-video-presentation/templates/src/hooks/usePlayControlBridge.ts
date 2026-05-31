import { useEffect } from "react";

/** 通知父頁（WvpPlayShell）目前游標位置，用於啟用/停用翻頁按鈕 */
export function notifyCursorToParent(globalIndex: number, totalGlobal: number) {
  try {
    window.parent.postMessage({ type: "cf-cursor", globalIndex, totalGlobal }, "*");
  } catch {
    /* cross-origin or no parent */
  }
}

type BridgeOpts = {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onStartAuto?: () => void;
  onSubsOn?: () => void;
  onSubsOff?: () => void;
};

/** CourseFlow 預覽外殼（iframe 父頁）與鍵盤轉發 */
export function usePlayControlBridge(opts: BridgeOpts) {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; action?: string };
      if (data?.type !== "cf-play-control") return;
      switch (data.action) {
        case "first":
          opts.onFirst();
          break;
        case "prev":
          opts.onPrev();
          break;
        case "next":
          opts.onNext();
          break;
        case "last":
          opts.onLast();
          break;
        case "start-auto":
          opts.onStartAuto?.();
          break;
        case "subs-on":
          opts.onSubsOn?.();
          break;
        case "subs-off":
          opts.onSubsOff?.();
          break;
        case "space": {
          const gateOpen = document.querySelector(".auto-gate");
          if (gateOpen && opts.onStartAuto) opts.onStartAuto();
          else opts.onNext();
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    opts.onFirst,
    opts.onPrev,
    opts.onNext,
    opts.onLast,
    opts.onStartAuto,
    opts.onSubsOn,
    opts.onSubsOff,
  ]);
}
