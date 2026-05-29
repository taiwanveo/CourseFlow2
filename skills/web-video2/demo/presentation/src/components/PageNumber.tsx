import { useEffect, useState } from "react";
import type { PlaybackMode } from "../hooks/useAudioPlayer";
import "./PageNumber.css";

interface Props {
  /** 0-based chapter index from `useStepper().cursor.chapter`. */
  chapterIdx: number;
  /** 0-based step index from `useStepper().cursor.step`. */
  step: number;
  /** Current playback mode. Auto / section modes force-hide. */
  mode: PlaybackMode;
  /** `?recording=1` flag — when true, force-hide. */
  recording: boolean;
}

/**
 * Bottom-right page number.
 *
 * Format: `{chapter+1}.{step+1}` — e.g. chapter 2 / step 3 → "2.3".
 * Powers dialogue addressing ("rewrite 2.3" / "節奏改一下 1.4").
 *
 * Visibility:
 *   • Hidden by default (opacity 0).
 *   • Pointer over `.stage-frame` / `.stage-fitter` → fade in 200ms.
 *   • Pointer leaves the stage → fade out 600ms.
 *   • `mode === 'auto' | 'section'` → force-hide.
 *   • `?recording=1` → force-hide.
 *
 * `.stage-frame` and `.stage-fitter` are both targeted because the
 * fitter is the actual visible-pixel container (1920*scale × 1080*scale)
 * while the frame is the transformed inner 1920×1080 surface — depending
 * on whether the user is hovering over a chapter element or the empty
 * letterbox area in `contain` fit, one or the other is the event target.
 */
export function PageNumber({ chapterIdx, step, mode, recording }: Props) {
  const [over, setOver] = useState(false);

  const forceHide = recording || mode === "auto" || mode === "section";

  useEffect(() => {
    if (forceHide) {
      setOver(false);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const inStage = !!t?.closest(".stage-frame, .stage-fitter");
      setOver(inStage);
    };
    const onLeave = () => setOver(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [forceHide]);

  if (forceHide) return null;

  return (
    <div
      className={`pn ${over ? "pn-on" : ""}`}
      data-no-advance
      aria-label={`Page ${chapterIdx + 1}.${step + 1}`}
    >
      {chapterIdx + 1}.{step + 1}
    </div>
  );
}
