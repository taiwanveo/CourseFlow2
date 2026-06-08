import { useCallback, useRef, useState } from "react";
import type { PlaybackMode } from "./useAudioPlayer";

/**
 * Pause / resume orchestration for the TopMenu.
 *
 * Strategy: we don't extend `useAudioPlayer` with a `paused` flag — instead
 * pausing temporarily forces `mode = 'manual'` (which already stops audio
 * + auto-advance via the existing state machine), and resuming restores
 * the previous mode. This keeps the playback hook simple and avoids
 * a third "is everything paused?" state to reason about.
 *
 * The caller (App.tsx integration) is also responsible for gating Stage
 * clicks while `paused === true` (e.g. by wrapping `onAdvance` to a no-op).
 *
 * Usage:
 *   const { mode, setMode } = useAutoMode();
 *   const pauseCtl = usePauseControl(mode, setMode);
 *   // <Stage onAdvance={pauseCtl.paused ? () => {} : stepper.next} />
 *   // <TopMenu paused={pauseCtl.paused} onPause={pauseCtl.pause} onPlay={pauseCtl.unpause} ... />
 */
export interface PauseControl {
  paused: boolean;
  pause(): void;
  unpause(): void;
  toggle(): void;
}

export function usePauseControl(
  mode: PlaybackMode,
  setMode: (m: PlaybackMode) => void,
): PauseControl {
  const [paused, setPaused] = useState(false);
  // Remember the mode we paused FROM so unpause restores it accurately.
  // Stored in a ref because reads happen inside callbacks and we don't
  // want to recreate them on every mode change.
  const savedRef = useRef<PlaybackMode>(mode);

  const pause = useCallback(() => {
    if (paused) return;
    savedRef.current = mode;
    setMode("manual");
    setPaused(true);
  }, [paused, mode, setMode]);

  const unpause = useCallback(() => {
    if (!paused) return;
    setMode(savedRef.current);
    setPaused(false);
  }, [paused, setMode]);

  const toggle = useCallback(() => {
    if (paused) unpause();
    else pause();
  }, [paused, pause, unpause]);

  return { paused, pause, unpause, toggle };
}

/**
 * Read `?recording=1` from the current URL. Pure read — not reactive —
 * because the recording flag is a deploy-time decision, not a live toggle.
 */
export function isRecordingMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("recording") === "1";
}

/**
 * MP4 匯出錄製模式：跳過「按空白鍵開始」overlay，並允許自動播放音訊。
 */
export function isExportMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("export") === "1";
}
