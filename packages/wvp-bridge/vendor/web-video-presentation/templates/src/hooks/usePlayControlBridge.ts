import { useEffect } from "react";

type BridgeOpts = {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onStartAuto?: () => void;
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
  ]);
}
