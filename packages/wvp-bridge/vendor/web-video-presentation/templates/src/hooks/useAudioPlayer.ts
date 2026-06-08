import { useEffect, useRef } from "react";

export type PlaybackMode = "manual" | "audio" | "auto";

/** 極短靜音 WAV：在父頁 postMessage 換頁時先解鎖 iframe 音訊（CourseFlow 預覽外殼） */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

/** 由 usePlayControlBridge 在收到使用者換頁手勢時呼叫，延長手勢視窗避免開頭被吃掉 */
export function unlockAudioPlayback(): void {
  if (typeof window === "undefined") return;
  const probe = new Audio(SILENT_WAV);
  probe.volume = 0.001;
  void probe
    .play()
    .then(() => {
      probe.pause();
      probe.removeAttribute("src");
    })
    .catch(() => {
      /* 仍嘗試正式播放 */
    });
}

interface Options {
  /** Audio file path. `null` = no audio for this step (silent). */
  src: string | null;
  /** `manual` = no playback. `audio` = play but don't auto-advance.
   *  `auto` = play and auto-advance when finished. */
  mode: PlaybackMode;
  /** Small breathing pad (ms) after audio finishes before advancing,
   *  in `auto` mode. Default 200ms. Set to 0 if mp3 already has trailing
   *  silence. */
  trailMs?: number;
  /** Fallback duration (ms) for `auto` mode when the audio file is missing
   *  or fails to play. Typically computed from text length. */
  estimateFallbackMs?: number;
  /** Called when `auto` mode determines the step is finished. */
  onAutoAdvance: () => void;
  /** Has the user started auto playback? (Browsers block autoplay until
   *  the page receives a user gesture; the AutoStartGate flips this.) */
  autoStarted: boolean;
  /** Playback speed multiplier (1 / 1.25 / 1.5 / 2). Applied to the
   *  `<audio>` element so both step duration and advance timing shrink
   *  proportionally. Default 1. */
  playbackRate?: number;
}

/**
 * 等音訊緩衝就緒後再從 0 秒播放。
 * 過早 play() 會讓瀏覽器略過開頭約 0.5–1 秒（聽起來像從第二個字開始）。
 */
function playFromStart(
  audio: HTMLAudioElement,
  playbackRate: number,
  cancelled: () => boolean,
  onFail: (err: unknown) => void,
): () => void {
  audio.playbackRate = playbackRate;
  audio.preload = "auto";

  let begun = false;
  let canPlayDelayTimer: number | undefined;
  let fallbackTimer: number | undefined;
  const removers: Array<() => void> = [];

  const addListener = (
    type: keyof HTMLMediaElementEventMap,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => {
    audio.addEventListener(type, listener, options);
    removers.push(() => audio.removeEventListener(type, listener));
  };

  const begin = () => {
    if (cancelled() || begun) return;
    begun = true;
    if (canPlayDelayTimer !== undefined) {
      clearTimeout(canPlayDelayTimer);
      canPlayDelayTimer = undefined;
    }
    if (fallbackTimer !== undefined) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
    try {
      audio.currentTime = 0;
    } catch {
      /* metadata 尚未就緒 */
    }
    void audio.play().catch(onFail);
  };

  const onPlaying = () => {
    if (audio.currentTime > 0.1) {
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  };
  addListener("playing", onPlaying as EventListener, { once: true });

  if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
    begin();
  } else {
    addListener("canplaythrough", begin as EventListener, { once: true });
    addListener("canplay", (() => {
      if (begun || cancelled()) return;
      canPlayDelayTimer = window.setTimeout(() => {
        if (!begun && !cancelled()) begin();
      }, 120);
    }) as EventListener, { once: true });
    fallbackTimer = window.setTimeout(() => {
      if (!begun && !cancelled()) begin();
    }, 12_000);
  }

  return () => {
    if (canPlayDelayTimer !== undefined) clearTimeout(canPlayDelayTimer);
    if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
    for (const remove of removers) remove();
  };
}

/**
 * Per-step audio playback for the presentation.
 *
 * Manages a single hidden `<audio>` element. Switches `src` whenever the
 * current step changes.
 *
 * In `auto` mode:
 *   • Audio file present → advance `trailMs` after the audio's `ended` event.
 *   • Audio file missing / blocked / src = null → advance after
 *     `estimateFallbackMs` (so previews and silent steps still work).
 *
 * Audio playback is the sole driver of step duration — there is intentionally
 * no "minimum hold" knob. If a chapter's visual animation needs more time,
 * the chapter should write longer narration, split the step, or speed the
 * animation up. This keeps Auto-mode behavior trivially predictable.
 */
export function useAudioPlayer({
  src,
  mode,
  trailMs = 200,
  estimateFallbackMs = 1500,
  onAutoAdvance,
  autoStarted,
  playbackRate = 1,
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
    let timer: number | null = null;
    let cancelPlayReady: (() => void) | undefined;

    const cancelled = () => advanced;

    const advanceAfter = (ms: number) => {
      if (mode !== "auto" || advanced) return;
      timer = window.setTimeout(() => {
        if (advanced) return;
        advanced = true;
        onAdvanceRef.current();
      }, Math.max(0, ms));
    };

    const onPlayFail = (err: unknown) => {
      console.warn("audio play failed:", err);
      if (mode === "auto") advanceAfter(estimateFallbackMs);
    };

    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;

      audio.addEventListener("ended", () => advanceAfter(trailMs));
      audio.addEventListener("error", () => {
        if (mode === "auto") advanceAfter(estimateFallbackMs);
      });

      cancelPlayReady = playFromStart(audio, playbackRate, cancelled, onPlayFail);
    } else if (mode === "auto") {
      advanceAfter(estimateFallbackMs);
    }

    return () => {
      advanced = true;
      cancelPlayReady?.();
      if (timer != null) clearTimeout(timer);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        audioRef.current = null;
      }
    };
  }, [src, mode, trailMs, estimateFallbackMs, autoStarted, playbackRate]);
}
