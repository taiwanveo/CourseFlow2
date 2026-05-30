import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CourseComposition, VisualElement } from "@courseflow/core";
import {
  buildSubtitleOverlayStyle,
  getOrderedSteps,
  isChapterStep,
  resolveSubtitleStyle,
  resolveSubtitleDisplayText,
  visualTextBoxDomStyle,
  visualTextClassName,
} from "@courseflow/core";

const ENTER_ANIMATION_CLASS: Record<string, string> = {
  "fade-up": "anim-fade-up",
  "fade-in": "anim-fade-in",
  "scale-in": "anim-scale-in",
  "slide-left": "anim-slide-left",
  "blur-in": "anim-blur-in",
};

function enterClassFor(id: string): string {
  return ENTER_ANIMATION_CLASS[id] ?? "anim-fade-up";
}

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const sw = window.innerWidth / 1920;
      const sh = window.innerHeight / 1080;
      setScale(Math.min(sw, sh));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

const NO_AUDIO_MS = 5000;

function noAudioAdvanceMs(): number {
  return NO_AUDIO_MS;
}

function renderVisual(el: VisualElement, enterClass: string, themeActive: boolean) {
  if (el.type === "image") {
    return (
      <img
        key={el.id}
        className={`visual-image ${enterClass}`}
        src={el.publicUrl}
        alt=""
        style={{
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          opacity: el.opacity,
          zIndex: el.zIndex,
        }}
      />
    );
  }
  const isHero = el.id.endsWith("-hero");
  return (
    <div
      key={el.id}
      className={`${visualTextClassName(isHero, themeActive)} ${enterClass}`}
      style={visualTextBoxDomStyle(el, { themeActive }) as React.CSSProperties}
    >
      {el.content}
    </div>
  );
}

function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72L19 12 8 5.14z" />
    </svg>
  );
}

function IconManualMode({ manual }: { manual?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {manual ? (
        /* 手動模式：手形圖示 */
        <path
          d="M9 11V6a1.5 1.5 0 0 1 3 0v5m0 0V5a1.5 1.5 0 0 1 3 0v6m0 0a1.5 1.5 0 0 1 3 0v2c0 3.314-2.686 6-6 6H11A5 5 0 0 1 6 14v-3a1.5 1.5 0 0 1 3 0v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        /* 自動模式：循環箭頭圖示 */
        <>
          <path
            d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M18 4l1.5 4-4-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 20l-1.5-4 4 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function IconCaptions({ off }: { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 14h4M13 14h4M7 10h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {off ? (
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

export interface CourseFlowPlayerProps {
  composition: CourseComposition;
  /** @deprecated 播放器固定為自動播放 */
  initialMode?: "auto";
  themeTokensCss?: string;
  subtitlesEnabled?: boolean;
  onSubtitlesEnabledChange?: (enabled: boolean) => void;
}

export function CourseFlowPlayer({
  composition,
  themeTokensCss,
  subtitlesEnabled: subtitlesEnabledProp,
  onSubtitlesEnabledChange,
}: CourseFlowPlayerProps) {
  const ordered = useMemo(() => getOrderedSteps(composition), [composition]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [statusShown, setStatusShown] = useState(true);
  const [subtitlesInternal, setSubtitlesInternal] = useState(true);
  const subtitlesOn = subtitlesEnabledProp ?? subtitlesInternal;
  const setSubtitlesOn = onSubtitlesEnabledChange ?? setSubtitlesInternal;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const scriptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptRemainingRef = useRef<number | null>(null);
  const scriptStartedAtRef = useRef(0);
  const goNextRef = useRef<(() => void) | null>(null);
  const scheduleScriptAdvanceRef = useRef<((ms: number) => void) | null>(null);
  // ref 供 useLayoutEffect callback 讀取最新值（不觸發 re-run）
  const manualModeRef = useRef(manualMode);
  manualModeRef.current = manualMode;
  const scale = useStageScale();

  const step = ordered[index];
  const visual = composition.visuals.find((v) => v.stepId === step?.id);
  // 章節層級配圖：若本章有固定圖片（ai-image / upload），覆寫步驟背景
  const chapterVisual = composition.chapterVisuals?.find(
    (cv) => cv.chapterId === step?.chapterId && cv.visualMode !== "animation",
  );
  const audio = composition.audio.find((a) => a.stepId === step?.id);
  const subtitle = composition.subtitles.find((s) => s.stepId === step?.id);
  const subStyle = resolveSubtitleStyle(subtitle?.style);
  const subPos = subtitle?.position;
  const subtitleOverlayStyle = buildSubtitleOverlayStyle(subStyle, subPos);
  const subtitleText = subtitle
    ? resolveSubtitleDisplayText(subtitle.segments, step?.script ?? "")
    : "";
  const showSubtitle =
    subtitlesOn &&
    step != null &&
    !isChapterStep(step) &&
    Boolean(subtitle && subtitleText);
  const enterClass = enterClassFor(visual?.enterAnimationId ?? "fade-up");
  const themeActive = Boolean(themeTokensCss);

  const clearScriptTimer = useCallback(() => {
    if (scriptTimerRef.current) {
      clearTimeout(scriptTimerRef.current);
      scriptTimerRef.current = null;
    }
  }, []);

  const scheduleScriptAdvance = useCallback(
    (ms: number) => {
      clearScriptTimer();
      scriptRemainingRef.current = ms;
      scriptStartedAtRef.current = Date.now();
      scriptTimerRef.current = setTimeout(() => {
        scriptRemainingRef.current = null;
        setIndex((i) => {
          if (i >= ordered.length - 1) {
            document.documentElement.dataset.cfPresentationDone = "1";
            window.dispatchEvent(new Event("cf-presentation-auto-done"));
            return i;
          }
          return i + 1;
        });
      }, ms);
    },
    [clearScriptTimer, ordered.length],
  );

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= ordered.length - 1) {
        document.documentElement.dataset.cfPresentationDone = "1";
        window.dispatchEvent(new Event("cf-presentation-auto-done"));
        return i;
      }
      return i + 1;
    });
  }, [ordered.length]);

  const togglePaused = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const toggleManualMode = useCallback(() => {
    setManualMode((m) => !m);
  }, []);

  goNextRef.current = goNext;
  scheduleScriptAdvanceRef.current = scheduleScriptAdvance;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePaused();
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleManualMode();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext, togglePaused, toggleManualMode]);

  useLayoutEffect(() => {
    if (!step || paused) return;

    clearScriptTimer();
    scriptRemainingRef.current = null;

    const el = audioRef.current;
    let cancelled = false;
    let onEnded: (() => void) | undefined;

    if (audio?.publicUrl && el) {
      el.src = audio.publicUrl;
      el.currentTime = 0;
      onEnded = () => {
        // 手動模式：音訊播畢後不自動推進
        if (!cancelled && !manualModeRef.current) goNextRef.current?.();
      };
      el.addEventListener("ended", onEnded);
      el.play().catch(() => {
        if (!cancelled && !manualModeRef.current)
          scheduleScriptAdvanceRef.current?.(noAudioAdvanceMs());
      });
    } else {
      // 手動模式：無音訊時也不自動推進
      if (!manualModeRef.current)
        scheduleScriptAdvanceRef.current?.(noAudioAdvanceMs());
    }

    return () => {
      cancelled = true;
      if (el && onEnded) el.removeEventListener("ended", onEnded);
      clearScriptTimer();
    };
  }, [step?.id, audio?.publicUrl, paused, clearScriptTimer]);

  const prevPausedRef = useRef<boolean | null>(null);

  useEffect(() => {
    prevPausedRef.current = null;
  }, [step?.id]);

  useEffect(() => {
    if (!step) return;
    const el = audioRef.current;

    if (prevPausedRef.current === null) {
      prevPausedRef.current = paused;
      return;
    }
    if (prevPausedRef.current === paused) return;
    prevPausedRef.current = paused;

    if (paused) {
      el?.pause();
      if (scriptTimerRef.current) {
        const elapsed = Date.now() - scriptStartedAtRef.current;
        scriptRemainingRef.current = Math.max(
          0,
          (scriptRemainingRef.current ?? noAudioAdvanceMs()) - elapsed,
        );
        clearScriptTimer();
      }
      return;
    }

    if (audio?.publicUrl && el?.src) {
      el.play().catch(() => {
        const remaining =
          scriptRemainingRef.current ?? noAudioAdvanceMs();
        if (remaining > 0) scheduleScriptAdvance(remaining);
      });
    } else {
      const remaining = scriptRemainingRef.current ?? noAudioAdvanceMs();
      if (remaining > 0) scheduleScriptAdvance(remaining);
    }
  }, [paused, audio?.publicUrl, step, clearScriptTimer, scheduleScriptAdvance]);

  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm || !composition.bgm.publicUrl) return;
    bgm.volume = composition.bgm.volume;
    bgm.loop = true;
    if (paused) {
      bgm.pause();
    } else {
      bgm.play().catch(() => {});
    }
  }, [composition.bgm, paused]);

  const statusText = manualMode
    ? paused
      ? "手動·已暫停"
      : "手動模式"
    : paused
      ? "已暫停"
      : "自動播放中";

  useEffect(() => {
    setStatusShown(true);
    const id = window.setTimeout(() => setStatusShown(false), 3000);
    return () => window.clearTimeout(id);
  }, [paused, manualMode]);

  if (!step) return null;

  const bg = chapterVisual?.background ?? visual?.background;
  const frameStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    ...(bg?.type === "image" && bg.publicUrl
      ? {
          backgroundImage: `url(${bg.publicUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: bg.opacity,
        }
      : themeActive
        ? {}
        : { background: bg?.color ?? "#1a1a2e" }),
  };

  const progress = ((index + 1) / ordered.length) * 100;

  return (
    <div className="app-shell">
      {themeTokensCss ? <style>{themeTokensCss}</style> : null}
      <button
        type="button"
        className="nav-btn nav-btn-left"
        aria-label="上一頁"
        disabled={index === 0}
        onClick={goPrev}
      >
        ◄
      </button>
      <button
        type="button"
        className="nav-btn nav-btn-right"
        aria-label="下一頁"
        disabled={index >= ordered.length - 1}
        onClick={goNext}
      >
        ►
      </button>
      <div
        className="stage-fitter"
        style={{ width: 1920 * scale, height: 1080 * scale }}
      >
        <div
          key={index}
          className="stage-frame scene-enter"
          style={{ transform: `scale(${scale})`, ...frameStyle }}
        >
          {(visual?.elements ?? [])
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((el) => renderVisual(el, enterClass, themeActive))}
          {showSubtitle ? (
            <div className="subtitle-overlay" style={subtitleOverlayStyle}>
              {subtitleText}
            </div>
          ) : null}
        </div>
      </div>
      <audio ref={audioRef} style={{ display: "none" }} />
      {composition.bgm.publicUrl ? (
        <audio ref={bgmRef} src={composition.bgm.publicUrl} style={{ display: "none" }} />
      ) : null}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p
        className={`playback-status${statusShown ? "" : " playback-status--hidden"}`}
        aria-live="polite"
      >
        {statusText}
      </p>
      <div className="player-controls-dock">
        <button
          type="button"
          className="player-control-btn"
          onClick={togglePaused}
          aria-label={paused ? "繼續播放" : "暫停"}
          title={paused ? "繼續播放（空白鍵）" : "暫停（空白鍵）"}
        >
          {paused ? <IconPlay /> : <IconPause />}
        </button>
        <button
          type="button"
          className={cnPlayerControlBtn(!manualMode)}
          onClick={toggleManualMode}
          aria-pressed={manualMode}
          aria-label={manualMode ? "切換自動播放" : "切換手動模式"}
          title={manualMode ? "自動播放（M）" : "手動模式（M）"}
        >
          <IconManualMode manual={manualMode} />
        </button>
        <button
          type="button"
          className={cnPlayerControlBtn(subtitlesOn)}
          onClick={() => setSubtitlesOn(!subtitlesOn)}
          aria-pressed={subtitlesOn}
          aria-label={subtitlesOn ? "關閉字幕" : "開啟字幕"}
          title={subtitlesOn ? "關閉字幕" : "開啟字幕"}
        >
          <IconCaptions off={!subtitlesOn} />
        </button>
      </div>
    </div>
  );
}

function cnPlayerControlBtn(active: boolean): string {
  return `player-control-btn${active ? "" : " player-control-btn-muted"}`;
}

export default CourseFlowPlayer;
