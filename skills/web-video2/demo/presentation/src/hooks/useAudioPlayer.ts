import { useEffect, useRef } from "react";

/**
 * `manual` = no playback. `audio` = play but don't auto-advance.
 * `section` = play AND auto-advance until the end of the current chapter,
 *             then stop (boundary check lives at the App-level
 *             onAutoAdvance — see App.tsx integration, spec §11 B2).
 * `auto`    = play and auto-advance through the entire deck.
 *
 * For playback purposes, `section` and `auto` are identical inside this
 * hook: audio plays, `onAutoAdvance` fires on `ended`. The chapter-end
 * stop logic is the caller's responsibility (gate `onAutoAdvance` to a
 * no-op when `mode === 'section'` and the stepper is at the last step
 * of the current chapter).
 */
export type PlaybackMode = "manual" | "audio" | "section" | "auto";

interface Options {
  /** Audio file path. `null` = no audio for this step (silent). */
  src: string | null;
  /** `manual` = no playback. `audio` = play but don't auto-advance.
   *  `section` / `auto` = play and auto-advance when finished. (For this
   *  hook the two are identical — `section`'s chapter-end stop is enforced
   *  by the caller via `onAutoAdvance`.) */
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
  /** Audio playback speed multiplier (1 = normal, 1.5 = 50% faster).
   *  Forwarded to `audio.playbackRate`. Default 1. Browsers preserve
   *  pitch automatically up to ~4×. In auto/section modes step advance
   *  scales naturally (audio.ended fires earlier when sped up). The
   *  estimate fallback for missing audio is also scaled by this rate. */
  playbackRate?: number;
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
  // Latest callback ref so timers don't capture stale closures.
  const onAdvanceRef = useRef(onAutoAdvance);
  onAdvanceRef.current = onAutoAdvance;

  // Apply the latest playback rate to whatever audio element is live.
  // Separate from the audio-creation effect so we can update rate
  // mid-step (user hits the cycle button while a clip is playing)
  // without tearing down and re-loading the audio. Browsers honour the
  // change immediately and continue from the current position.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const prev = audioRef.current;
    if (prev) {
      prev.pause();
      prev.removeAttribute("src");
      prev.load();
      audioRef.current = null;
    }

    if (mode === "manual") return;
    // `section` and `auto` both require a user gesture before audio can
    // autoplay; the AutoStartGate flips `autoStarted` for both.
    const isAutoAdvance = mode === "auto" || mode === "section";
    if (isAutoAdvance && !autoStarted) return;

    let advanced = false;
    let timer: number | null = null;

    const advanceAfter = (ms: number) => {
      if (!isAutoAdvance || advanced) return;
      timer = window.setTimeout(() => {
        if (advanced) return;
        advanced = true;
        onAdvanceRef.current();
      }, Math.max(0, ms));
    };

    // Scale the silent-fallback duration too: at 2× a real audio clip
    // would finish in half the time, so the estimate should as well.
    // Clamp the divisor so a stray 0 doesn't divide by zero.
    const safeRate = playbackRate > 0 ? playbackRate : 1;
    const fallbackMs = estimateFallbackMs / safeRate;

    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.preload = "auto";
      audio.playbackRate = safeRate;

      audio.addEventListener("ended", () => advanceAfter(trailMs));
      audio.addEventListener("error", () => {
        // Audio file missing or undecodable — fall back to estimate.
        if (isAutoAdvance) advanceAfter(fallbackMs);
      });

      audio.play().catch((err) => {
        // Autoplay blocked (rare, AutoStartGate should prevent this) or
        // file missing — fall back to estimate in auto/section mode.
        console.warn("audio play failed:", err);
        if (isAutoAdvance) advanceAfter(fallbackMs);
      });
    } else if (isAutoAdvance) {
      // No audio for this step (silent / empty narration) — use estimate.
      advanceAfter(fallbackMs);
    }

    return () => {
      advanced = true;
      if (timer != null) clearTimeout(timer);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        audioRef.current = null;
      }
    };
    // playbackRate intentionally NOT in deps: rate changes are applied
    // by the separate effect above without re-creating the <audio>.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, mode, trailMs, estimateFallbackMs, autoStarted]);
}
