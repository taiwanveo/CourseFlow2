"use client";

import { playWarningSound } from "@/lib/ui-sounds";
import { useEffect, useRef } from "react";

/** 畫面上出現非 Toast 的錯誤文字時播放警告音 */
export function usePlaySoundOnError(error: string | null | undefined) {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const msg = error?.trim() || null;
    if (msg && msg !== prev.current) {
      playWarningSound();
    }
    prev.current = msg;
  }, [error]);
}
