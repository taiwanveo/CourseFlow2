import { useCallback, useEffect, useState } from "react";

export interface PdfExportApi {
  /** True while the print deck is mounted (between exportPdf() and afterprint). */
  printing: boolean;
  /**
   * Enter print mode → flush the print deck to the DOM → invoke
   * `window.print()`. Returns a Promise that resolves on `afterprint` so
   * callers can chain UI feedback (e.g. re-enable a button).
   *
   * Idempotent: if already printing, resolves immediately.
   */
  exportPdf(): Promise<void>;
}

/**
 * PDF export pipeline (spec §4 D3 / D4, §11 B5).
 *
 * Path A — `window.print()` (default, this hook):
 *   1. Set React state `printing = true` so App.tsx swaps its render to the
 *      `.print-deck` branch (all steps mounted at once, one `.scene-print`
 *      per step, with `page-break-before: always`).
 *   2. Add `.printing` class to <body> so `styles/print.css` and
 *      `SubtitleBar.css @media print` engage.
 *   3. Wait two RAFs so React has flushed the new tree before the browser
 *      snapshots it for printing.
 *   4. Call `window.print()`.
 *   5. On `afterprint`, tear down: clear the class + state.
 *
 * Path B — `html2pdf.js` fallback:
 *   If real-world print fidelity is bad (broken animations, missing fonts),
 *   swap this hook's body to:
 *     - npm install html2pdf.js
 *     - for each `.scene-print` element, html2pdf(...).save()
 *   This path keeps the same React-level contract (printing state, etc.)
 *   so App.tsx and TopMenu don't need to change.
 *
 * One PDF page = one step. A chapter with N narrations produces N pages.
 * Page order follows `CHAPTERS` registry order.
 */
export function usePdfExport(): PdfExportApi {
  const [printing, setPrinting] = useState(false);

  // Auto-cleanup when the user finishes / cancels the system print dialog.
  // `afterprint` fires on both confirm and cancel in every major browser.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onAfter() {
      document.body.classList.remove("printing");
      document.documentElement.classList.remove("printing");
      setPrinting(false);
    }
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  const exportPdf = useCallback((): Promise<void> => {
    if (typeof window === "undefined") return Promise.resolve();
    if (printing) return Promise.resolve();

    return new Promise<void>((resolve) => {
      // Resolve when the system print dialog closes (success OR cancel).
      function onAfter() {
        window.removeEventListener("afterprint", onAfter);
        resolve();
      }
      window.addEventListener("afterprint", onAfter);

      setPrinting(true);
      document.body.classList.add("printing");
      document.documentElement.classList.add("printing");

      // Two RAFs: first lets React commit the print deck to the DOM,
      // second lets the browser do its post-commit layout pass before we
      // hand off to the print engine. Without this, some browsers
      // snapshot a stale frame and miss the late-mounted steps.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    });
  }, [printing]);

  return { printing, exportPdf };
}
