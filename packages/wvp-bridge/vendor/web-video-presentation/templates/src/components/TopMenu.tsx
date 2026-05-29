import type { MouseEvent } from "react";
import type { PlaybackMode } from "../hooks/useAudioPlayer";
import "./TopMenu.css";

interface Props {
  /** Current playback mode. Drives visibility (hidden in auto/section)
   *  and highlight state on the auto-* buttons. */
  mode: PlaybackMode;
  /** `?recording=1` flag — when true, force-hide the menu (chrome rule). */
  recording: boolean;
  /** Whether playback is currently paused (via this menu). Drives Pause /
   *  Play button swap. */
  paused: boolean;
  /** Current audio playback speed multiplier (1 / 1.25 / 1.5 / 2). Shown
   *  on the speed cycle button. */
  playbackRate: number;

  /** Restart the deck: jumpToChapter(0, 0). */
  onRestart(): void;
  /** Enter paused state (stop audio + block stage advance). */
  onPause(): void;
  /** Leave paused state (restore prior mode). */
  onPlay(): void;
  /** Switch playback mode to 'section' — auto-play current chapter only. */
  onAutoSection(): void;
  /** Switch playback mode to 'auto' — auto-play whole deck. */
  onAutoAll(): void;
  /** Cycle audio playback rate: 1× → 1.25× → 1.5× → 2× → 1×. */
  onCycleSpeed(): void;
  /** Trigger PDF export. The actual implementation lives in B5's
   *  `usePdfExport`; the App-level integration wires that here. */
  onDownloadPdf(): void;
}

/**
 * Top hover menu — appears 200ms after the pointer enters the top 5vh
 * of the viewport, hides 600ms after it leaves. Houses the playback
 * controls and the PDF download entry point.
 *
 * Visibility rules:
 *   • `?recording=1` → hard-hidden (chrome stripped for recordings).
 *   • Every other mode (manual / audio / section / auto) → MOUNTED but
 *     visually opacity 0 until the pointer enters the top trigger band.
 *     Hover reveal works in every mode — auto / section users need
 *     access to Pause and Restart just as much as manual users do.
 *
 * Earlier versions hard-hid the menu in auto / section to keep clean
 * recordings, but that left auto-mode users stranded with no way to
 * pause, restart, or download. Since the menu is opacity 0 by default,
 * a screen recording won't see it unless the user actively hovers.
 *
 * The TopMenu is presentational — all real state lives at App level.
 * App.tsx integration (architect at D1) wires:
 *   • onRestart   → useStepper().jumpToChapter(0, 0)
 *   • onPause     → usePauseControl.pause
 *   • onPlay      → usePauseControl.unpause
 *   • onAutoSection / onAutoAll → useAutoMode.setMode(...)
 *   • onDownloadPdf → usePdfExport().exportPdf  (B5)
 */
export function TopMenu({
  mode,
  recording,
  paused,
  playbackRate,
  onRestart,
  onPause,
  onPlay,
  onAutoSection,
  onAutoAll,
  onCycleSpeed,
  onDownloadPdf,
}: Props) {
  // Only `?recording=1` strips the menu outright — that flag is the
  // explicit "I'm recording, hide all chrome" opt-in. In every playback
  // mode the hover-reveal pattern is enough to keep the menu invisible
  // until the user actively reaches for it.
  if (recording) return null;

  const stop =
    (cb: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      cb();
    };

  return (
    <div className="tm-hover" data-no-advance>
      <div className="tm-bar" role="toolbar" aria-label="Presentation controls">
        <button
          type="button"
          className="tm-btn"
          onClick={stop(onRestart)}
          title="重頭開始（跳到第 1 章第 1 步）"
        >
          <span className="tm-btn-icon">↺</span>
          <span>Restart</span>
        </button>

        <span className="tm-sep" aria-hidden="true" />

        {paused ? (
          <button
            type="button"
            className="tm-btn"
            onClick={stop(onPlay)}
            title="繼續播放"
          >
            <span className="tm-btn-icon">▶</span>
            <span>Play</span>
          </button>
        ) : (
          <button
            type="button"
            className="tm-btn"
            onClick={stop(onPause)}
            title="暫停（停音訊 + 鎖點擊）"
          >
            <span className="tm-btn-icon">❚❚</span>
            <span>Pause</span>
          </button>
        )}

        <span className="tm-sep" aria-hidden="true" />

        <button
          type="button"
          className={`tm-btn${mode === "section" ? " tm-btn-active" : ""}`}
          onClick={stop(onAutoSection)}
          title="自動播放本章（到本章結尾停）"
        >
          <span className="tm-btn-icon">▸▸</span>
          <span>Auto Section</span>
        </button>
        <button
          type="button"
          className={`tm-btn${mode === "auto" ? " tm-btn-active" : ""}`}
          onClick={stop(onAutoAll)}
          title="全自動播放（整片）"
        >
          <span className="tm-btn-icon">▶▶</span>
          <span>Auto All</span>
        </button>

        <span className="tm-sep" aria-hidden="true" />

        <button
          type="button"
          className={`tm-btn tm-btn-speed${playbackRate !== 1 ? " tm-btn-active" : ""}`}
          onClick={stop(onCycleSpeed)}
          disabled={mode === "manual"}
          title={
            mode === "manual"
              ? "Manual 模式下無音訊可加速 — 切到 Audio / Auto / Section 才生效"
              : "切換播放速度（1× → 1.25× → 1.5× → 2×）"
          }
        >
          <span className="tm-btn-icon">⏩</span>
          <span>{playbackRate}×</span>
        </button>

        <span className="tm-sep" aria-hidden="true" />

        <button
          type="button"
          className="tm-btn tm-btn-pdf"
          onClick={stop(onDownloadPdf)}
          title="下載 PDF（所有 step 一頁一張）"
        >
          <span className="tm-btn-icon">⤓</span>
          <span>Download PDF</span>
        </button>
      </div>
    </div>
  );
}
