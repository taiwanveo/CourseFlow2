import type { CSSProperties, ReactNode } from "react";
import { useViewportFit } from "../hooks/useViewportFit";

interface Props {
  onAdvance(): void;
  children: ReactNode;
}

/**
 * The 16:9 stage. Click anywhere except interactive children = advance.
 *
 * Fit strategy (see hooks/useViewportFit.ts + references/URL-PARAMS.md):
 *   • contain (DEFAULT) — preserve 16:9 with letterbox margins. Every pixel
 *                         of the 1920×1080 design lands on screen, safe for
 *                         any chapter authored against the full frame.
 *   • cover   (opt-in via ?fit=cover) — fill the viewport, symmetric crop, no
 *                         black bars. Requires chapters to keep core visuals
 *                         inside the central 1600×900 safe area.
 *
 * Layout structure (3 nested elements):
 *   .app-shell    ← full viewport, flex-centers the fitter
 *   .stage-fitter ← sized to ACTUAL VISIBLE px (1920*scale × 1080*scale)
 *                   so the layout system honestly sees what's on screen
 *                   and centers it bulletproof on every viewport / DPR.
 *   .stage-frame  ← raw 1920×1080 box, scaled from top-left into the fitter.
 *
 * In cover mode the fitter can be larger than the viewport on one axis;
 * `body { overflow: hidden }` clips the overrun symmetrically thanks to
 * the flex-center on `.app-shell`. The fitter still reports its real
 * scaled size so any chapter using DOM measurement (rare) stays honest.
 *
 * Surface colors come from the active theme's CSS custom properties
 * (var(--shell), var(--surface)) — see themes/<id>/tokens.css.
 */
export function Stage({ onAdvance, children }: Props) {
  const { scale, fitterWidth, fitterHeight } = useViewportFit();
  const fitterStyle: CSSProperties = {
    width: fitterWidth,
    height: fitterHeight,
  };
  const frameStyle: CSSProperties = {
    transform: `scale(${scale})`,
  };
  return (
    <div className="app-shell">
      <div className="stage-fitter" style={fitterStyle}>
        <div
          className="stage-frame"
          style={frameStyle}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("button, a, input, [data-no-advance]")) return;
            onAdvance();
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
