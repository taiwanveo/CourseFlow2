import { useCallback, useEffect, useState } from "react";

/**
 * SubtitleBar enabled-state, persisted in localStorage and toggled by
 * the `S` keyboard shortcut.
 *
 * Initial value precedence:
 *   1. URL `?subs=off` → enabled = false (one-shot override; we still
 *      persist the resulting state so refreshing without the flag keeps
 *      whatever the user last had — but the URL flag wins on first load).
 *   2. localStorage (`presentation-subtitle-enabled-v2`) if present.
 *   3. Default `true` (subtitles ON, including in recording mode — by
 *      design, the subtitle bar IS recording content).
 *
 * The bar is independent of `?recording=1`: recording mode never forces
 * subtitles off. Only `?subs=off` or pressing `S` hides them.
 */
const STORAGE_KEY = "presentation-subtitle-enabled-v2";

function readUrlOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const v = q.get("subs");
  if (v === "off") return false;
  if (v === "on") return true;
  return null;
}

function readInitial(): boolean {
  const urlOverride = readUrlOverride();
  if (urlOverride !== null) return urlOverride;
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export interface SubtitleSettings {
  enabled: boolean;
  setEnabled(v: boolean): void;
  toggle(): void;
}

export function useSubtitleSettings(): SubtitleSettings {
  const [enabled, setEnabledState] = useState<boolean>(() => readInitial());

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((cur) => {
      const next = !cur;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Keyboard: `S` toggles subtitle visibility. Ignored while typing in
  // an input. Stays decoupled from useStepper / useAutoMode listeners
  // because those don't touch the `S` key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "s" || e.key === "S") {
        // Don't preventDefault — other listeners may legitimately want
        // the key — we just toggle.
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { enabled, setEnabled, toggle };
}
