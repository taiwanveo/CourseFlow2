import { useEffect, useState } from "react";

export type FitMode = "cover" | "contain";

export interface ViewportFit {
  /** Active fit strategy. Chosen once at mount from `?fit=`; defaults to `contain`. */
  mode: FitMode;
  /** Multiplier applied via transform: scale(...) to the 1920×1080 frame. */
  scale: number;
  /** Visible width of the fitter in CSS px (1920 × scale). */
  fitterWidth: number;
  /** Visible height of the fitter in CSS px (1080 × scale). */
  fitterHeight: number;
}

/**
 * Read the fit mode from URL search params once.
 *
 * Defaults to `contain` (preserve aspect, letterbox black bars on non-16:9
 * viewports) — safe for any chapter, nothing ever gets cropped off the edges.
 * Pass `?fit=cover` to opt into the "fill the viewport with symmetric crop,
 * no black bars" mode; chapters then MUST keep all core visuals inside the
 * central 1600×900 safe area (see CHAPTER-CRAFT.md).
 *
 * Design note: an earlier iteration defaulted to `cover` for "no black bars
 * out of the box", but it silently clipped chapter content authored against
 * the full 1920×1080 frame on common laptop viewports (16:10) — top-row
 * corner labels and bottom-edge elements disappeared. Reverted to `contain`
 * default so the "what you design is what you see" promise holds; `?fit=cover`
 * stays as an opt-in for recording / fullscreen presenting where you want
 * zero bars.
 */
function readModeFromUrl(): FitMode {
  if (typeof window === "undefined") return "contain";
  try {
    const fit = new URLSearchParams(window.location.search).get("fit");
    return fit === "cover" ? "cover" : "contain";
  } catch {
    return "contain";
  }
}

/**
 * Compute the transform scale for the 16:9 stage given the current viewport.
 *
 * `contain` (DEFAULT):
 *   scale = min((vw - marginX*2) / 1920, (vh - marginY*2) / 1080)
 *   → the fitter is fully visible, with breathing room for the progress bar
 *     and other edge UI. Letterboxed on non-16:9 viewports — nothing gets
 *     clipped, every pixel of the 1920×1080 design lands on screen.
 *
 * `cover` (opt-in via `?fit=cover`):
 *   scale = max(vw / 1920, vh / 1080)
 *   → the fitter is **as big as or bigger than** the viewport on both axes;
 *     `.app-shell` flex-centers it and `body { overflow: hidden }` symmetrically
 *     crops whichever axis overruns. No black bars — but chapters MUST keep
 *     core visuals inside the central 1600×900 safe area or they get cut off
 *     on 16:10 / 21:9 / 4:3 viewports.
 *
 * Listens to `resize` + `orientationchange` and stays cheap on idle.
 */
export function useViewportFit(
  baseW = 1920,
  baseH = 1080,
  // Tight default margins so a 16:9 viewport fills almost edge-to-edge.
  // Chrome (ProgressBar / TopMenu / SubtitleBar) is hover-only and overlays
  // the stage with z-index, so we don't need to reserve a letterbox band
  // for them — keep the stage as big as the viewport.
  marginX = 0,
  marginY = 0,
): ViewportFit {
  const [mode] = useState<FitMode>(readModeFromUrl);
  const [scale, setScale] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const m = readModeFromUrl();
    if (m === "cover") {
      return Math.max(window.innerWidth / baseW, window.innerHeight / baseH);
    }
    const usefulW = Math.max(320, window.innerWidth - marginX * 2);
    const usefulH = Math.max(180, window.innerHeight - marginY * 2);
    return Math.min(usefulW / baseW, usefulH / baseH);
  });

  useEffect(() => {
    function update() {
      if (mode === "cover") {
        const s = Math.max(
          window.innerWidth / baseW,
          window.innerHeight / baseH,
        );
        setScale(s);
      } else {
        const usefulW = Math.max(320, window.innerWidth - marginX * 2);
        const usefulH = Math.max(180, window.innerHeight - marginY * 2);
        setScale(Math.min(usefulW / baseW, usefulH / baseH));
      }
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [mode, baseW, baseH, marginX, marginY]);

  // Tag <body> with the active mode so CSS can pick the right safety
  // background (cover → --color-bg-deep so any sub-pixel rounding gap at
  // resize never flashes white).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    body.classList.remove("fit-cover", "fit-contain");
    body.classList.add(mode === "cover" ? "fit-cover" : "fit-contain");
    return () => {
      body.classList.remove("fit-cover", "fit-contain");
    };
  }, [mode]);

  return {
    mode,
    scale,
    fitterWidth: baseW * scale,
    fitterHeight: baseH * scale,
  };
}
