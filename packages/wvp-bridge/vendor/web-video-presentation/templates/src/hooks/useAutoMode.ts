import { useCallback, useEffect, useState } from "react";
import type { PlaybackMode } from "./useAudioPlayer";

/**
 * Cycle order. `section` slots between `audio` and `auto` so cycling
 * via `M` follows the natural intensity ladder:
 *   manual → audio → section → auto → manual
 */
const ORDER: PlaybackMode[] = ["manual", "audio", "section", "auto"];

function readModeFromURL(): PlaybackMode {
  if (typeof window === "undefined") return "manual";
  const q = new URLSearchParams(window.location.search);
  if (q.get("auto") === "1") return "auto";
  if (q.get("section") === "1") return "section";
  if (q.get("audio") === "1") return "audio";
  return "manual";
}

/**
 * Playback mode state machine + URL sync + keyboard toggle.
 *
 * Modes:
 *   • `manual`  — silent, you click / arrow-key to advance
 *   • `audio`   — audio plays per step, but you still click to advance
 *   • `section` — audio plays AND advances automatically, but stops at
 *                 the last step of the current chapter (boundary check
 *                 happens at the App-level `onAutoAdvance` — see spec
 *                 §11 B2 + App.tsx integration)
 *   • `auto`    — audio plays AND advances through the whole deck
 *                 (full recording mode)
 *
 * Initial mode is read from URL: `?auto=1` / `?section=1` / `?audio=1`.
 * Press `M` to cycle. URL stays in sync so reload preserves the mode.
 *
 * `autoStarted` exists separately because browsers require a user gesture
 * before audio can autoplay — `AutoStartGate` flips it on space-press.
 * Both `section` and `auto` are gated by it.
 */
export function useAutoMode() {
  const [mode, setModeState] = useState<PlaybackMode>(() => readModeFromURL());
  const [autoStarted, setAutoStarted] = useState(false);

  const setMode = useCallback((m: PlaybackMode) => {
    setModeState(m);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("audio");
    url.searchParams.delete("section");
    url.searchParams.delete("auto");
    if (m === "audio") url.searchParams.set("audio", "1");
    if (m === "section") url.searchParams.set("section", "1");
    if (m === "auto") url.searchParams.set("auto", "1");
    window.history.replaceState(null, "", url.toString());
    // autoStarted is only meaningful while we're in an auto-advance mode.
    // Drop it when leaving them so the next entry re-shows AutoStartGate.
    if (m !== "auto" && m !== "section") setAutoStarted(false);
  }, []);

  const cycleMode = useCallback(() => {
    setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!);
  }, [mode, setMode]);

  // Keyboard: `M` cycles mode. `Space` starts auto/section if gated.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        cycleMode();
      } else if (
        e.key === " " &&
        (mode === "auto" || mode === "section") &&
        !autoStarted
      ) {
        e.preventDefault();
        setAutoStarted(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, autoStarted, cycleMode]);

  return { mode, setMode, cycleMode, autoStarted, setAutoStarted };
}
