import { useCallback, useEffect, useState } from "react";

/**
 * Audio playback speeds offered by the cycle button. Adding a new value
 * here makes it cycle in; removing one is safe because invalid persisted
 * values fall back to 1.0.
 */
export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const STORAGE_KEY = "wv-speed-v1";

function readInitialRate(): PlaybackRate {
  if (typeof window === "undefined") return 1;
  // URL opt-in wins (so `?speed=1.5` deep links / share links work).
  try {
    const param = new URLSearchParams(window.location.search).get("speed");
    if (param) {
      const n = parseFloat(param);
      if ((PLAYBACK_RATES as readonly number[]).includes(n)) {
        return n as PlaybackRate;
      }
    }
  } catch {
    // ignore — fall through
  }
  // Persisted preference (set by previous session's cycle button).
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = parseFloat(stored);
      if ((PLAYBACK_RATES as readonly number[]).includes(n)) {
        return n as PlaybackRate;
      }
    }
  } catch {
    // ignore — fall through
  }
  return 1;
}

/**
 * Persisted audio playback rate for Audio / Section / Auto modes.
 *
 * The rate is passed to `useAudioPlayer`, which forwards it to the
 * `<audio>` element via `audio.playbackRate`. Auto-mode advance fires
 * on the (faster) `audio.ended` event, so step duration shrinks with
 * the rate naturally — no extra scheduling needed.
 *
 * Manual mode is unaffected: there is no audio playing, so the rate
 * has nothing to act on. (The TopMenu button should disable / hide
 * itself in manual to avoid a confusing no-op control.)
 *
 * Chapter CSS animations are NOT scaled by this hook — they keep their
 * authored timings. At 1.25× this is rarely noticeable; at 1.5×–2×
 * long reveal ladders may be cut short. If that becomes a real problem,
 * upgrade to the "B" plan (CSS-variable retrofit on chapter animations).
 */
export function usePlaybackRate() {
  const [rate, setRateState] = useState<PlaybackRate>(readInitialRate);

  // Persist every change so the user's preference survives reloads.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(rate));
    } catch {
      // localStorage disabled / quota — fail silently, runtime still works
    }
  }, [rate]);

  // Mirror the rate to a CSS custom property on <html> so chapter animations
  // that opt in (via `--anim-*` tokens or `calc(<ms> / var(--speed))`) scale
  // with the audio.  Framework chrome animations (TopMenu hover reveal,
  // AutoStartGate fade-in, etc.) intentionally use fixed durations and are
  // NOT affected — see references/CHAPTER-CRAFT.md "playback rate" section.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--speed", String(rate));
  }, [rate]);

  const setRate = useCallback((next: PlaybackRate) => {
    setRateState(next);
  }, []);

  const cycle = useCallback(() => {
    setRateState((cur) => {
      const i = PLAYBACK_RATES.indexOf(cur);
      return PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
    });
  }, []);

  return { rate, setRate, cycle };
}
