"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CourseComposition } from "@courseflow/core";
import "@courseflow/player/styles.css";

const CourseFlowPlayer = dynamic(
  () => import("@courseflow/player").then((m) => m.CourseFlowPlayer),
  { ssr: false },
);

export function PlayPageClient({
  projectId,
  composition,
  themeTokensCss,
}: {
  projectId: string;
  composition: CourseComposition;
  themeTokensCss?: string;
}) {
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shellRef.current?.requestFullscreen();
      }
    } catch {
      // 瀏覽器可能拒絕全螢幕請求
    }
  }, []);

  const goBackToVisual = () => {
    window.location.href = `/projects/${projectId}/visual?from=play&t=${Date.now()}`;
  };

  return (
    <div ref={shellRef} className="fixed inset-0 z-50 bg-black">
      <button
        type="button"
        className="play-page-goback-btn"
        aria-label="返回視覺動效"
        title="返回視覺動效"
        onClick={goBackToVisual}
      >
        ←
      </button>
      <button
        type="button"
        className="play-page-fullscreen-btn"
        aria-label={fullscreen ? "退出全螢幕" : "全螢幕播放"}
        title={fullscreen ? "退出全螢幕" : "全螢幕播放"}
        onClick={toggleFullscreen}
      >
        {fullscreen ? "退出全螢幕" : "全螢幕播放"}
      </button>
      <CourseFlowPlayer
        composition={composition}
        themeTokensCss={themeTokensCss}
        subtitlesEnabled={subtitlesOn}
        onSubtitlesEnabledChange={setSubtitlesOn}
      />
    </div>
  );
}
