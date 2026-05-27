import { useEffect, useRef } from "react";

export type PlaybackMode = "manual" | "audio" | "auto";

interface Options {
  /** Audio file path. `null` = no audio for this step (silent). */
  src: string | null;
  /** `manual` = no playback. `audio` = play but don't auto-advance.
   *  `auto` = play and auto-advance when finished. */
  mode: PlaybackMode;
  /** Pause (ms) after landing on a new step before starting audio. */
  leadMs?: number;
  /** Breathing pad (ms) after audio finishes before advancing, in `auto` mode. */
  trailMs?: number;
  /** Fallback duration (ms) for `auto` mode when the audio file is missing
   *  or fails to play. Typically computed from text length. */
  estimateFallbackMs?: number;
  /** Called when `auto` mode determines the step is finished. */
  onAutoAdvance: () => void;
  /** Has the user started auto playback? (Browsers block autoplay until
   *  the page receives a user gesture; the AutoStartGate flips this.) */
  autoStarted: boolean;
}

/**
 * Per-step audio playback for the presentation.
 *
 * Waits for `canplay` before `play()` so the opening of each mp3 is not clipped.
 * Uses `leadMs` / `trailMs` for pacing between steps in auto mode.
 */
export function useAudioPlayer({
  src,
  mode,
  leadMs = 0,
  trailMs = 200,
  estimateFallbackMs = 1500,
  onAutoAdvance,
  autoStarted,
}: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onAdvanceRef = useRef(onAutoAdvance);
  onAdvanceRef.current = onAutoAdvance;

  useEffect(() => {
    const prev = audioRef.current;
    if (prev) {
      prev.pause();
      prev.removeAttribute("src");
      prev.load();
      audioRef.current = null;
    }

    if (mode === "manual") return;
    if (mode === "auto" && !autoStarted) return;

    let advanced = false;
    let leadTimer: number | null = null;
    let trailTimer: number | null = null;

    const advanceAfter = (ms: number) => {
      if (mode !== "auto" || advanced) return;
      trailTimer = window.setTimeout(() => {
        if (advanced) return;
        advanced = true;
        onAdvanceRef.current();
      }, Math.max(0, ms));
    };

    const startAudio = () => {
      if (!src) {
        if (mode === "auto") advanceAfter(estimateFallbackMs);
        return;
      }

      const audio = new Audio(src);
      audioRef.current = audio;
      audio.preload = "auto";

      const playFromStart = () => {
        if (advanced) return;
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        void audio.play().catch((err) => {
          console.warn("audio play failed:", err);
          if (mode === "auto") advanceAfter(estimateFallbackMs);
        });
      };

      audio.addEventListener("ended", () => advanceAfter(trailMs));
      audio.addEventListener("error", () => {
        if (mode === "auto") advanceAfter(estimateFallbackMs);
      });

      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        playFromStart();
      } else {
        audio.addEventListener("canplay", playFromStart, { once: true });
        audio.load();
      }
    };

    const lead = Math.max(0, leadMs);
    if (lead > 0) {
      leadTimer = window.setTimeout(startAudio, lead);
    } else {
      startAudio();
    }

    return () => {
      advanced = true;
      if (leadTimer != null) clearTimeout(leadTimer);
      if (trailTimer != null) clearTimeout(trailTimer);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        audioRef.current = null;
      }
    };
  }, [src, mode, leadMs, trailMs, estimateFallbackMs, autoStarted]);
}
