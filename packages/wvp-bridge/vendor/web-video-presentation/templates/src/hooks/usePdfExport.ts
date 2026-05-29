import { useCallback, useEffect, useState } from "react";

export interface PdfExportApi {
  /** True while the print deck is mounted (between exportPdf() and afterprint). */
  printing: boolean;
  /**
   * Enter print mode → flush the print deck to the DOM → invoke
   * `window.print()` (Path A) or html2pdf.js canvas export (Path B).
   * Returns a Promise that resolves when export is complete or dialog closes.
   *
   * Path selection: add `?pdf=canvas` to the URL to activate html2pdf.js.
   * Default (no param): window.print() system dialog.
   *
   * Idempotent: if already printing, resolves immediately.
   */
  exportPdf(): Promise<void>;
}

/**
 * PDF export pipeline (spec §4 D3 / D4, §11 B5).
 *
 * Path A — `window.print()` (default):
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
 * Path B — `html2pdf.js` canvas fallback (activated via `?pdf=canvas`):
 *   Uses html2pdf.js to render each `.scene-print` via html2canvas, merging
 *   all slides into a single landscape PDF.  Useful when window.print()
 *   fidelity is poor (broken fonts, clipped animations, iOS Chrome).
 *   Requires html2pdf.js in package.json (already included by scaffold).
 *
 * One PDF page = one step. A chapter with N narrations produces N pages.
 * Page order follows `CHAPTERS` registry order.
 */
export function usePdfExport(): PdfExportApi {
  const [printing, setPrinting] = useState(false);

  // Auto-cleanup when the user finishes / cancels the system print dialog.
  // `afterprint` fires on both confirm and cancel in every major browser.
  // Not used in Path B, but kept so cleanup is idempotent.
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

    const useCanvas = new URLSearchParams(window.location.search).get("pdf") === "canvas";

    if (useCanvas) {
      // ── Path B — html2pdf.js canvas export ────────────────────────────
      return new Promise<void>((resolve, reject) => {
        setPrinting(true);
        document.body.classList.add("printing");
        document.documentElement.classList.add("printing");

        // Two RAFs: wait for React to flush the print deck before measuring.
        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            try {
              // Dynamic import — only loaded when ?pdf=canvas is active.
              const html2pdfModule = await import("html2pdf.js" as string);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const html2pdf = (html2pdfModule as any).default ?? html2pdfModule;

              const scenes = Array.from(
                document.querySelectorAll<HTMLElement>(".scene-print"),
              );
              if (scenes.length === 0) {
                console.warn("[usePdfExport] No .scene-print elements found.");
                resolve();
                return;
              }

              const opts = {
                margin: 0,
                filename: "presentation.pdf",
                image: { type: "jpeg", quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true },
                // 1920×1080 px in points at 96 dpi ≈ 508×285.75 mm
                jsPDF: {
                  unit: "mm",
                  format: [508, 285.75],
                  orientation: "landscape",
                },
                pagebreak: { mode: "avoid-all" },
              };

              // Build one PDF from the first scene, then add subsequent
              // scenes as additional pages.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let worker: any = html2pdf().set(opts).from(scenes[0]!);
              for (let i = 1; i < scenes.length; i++) {
                const scene = scenes[i]!;
                worker = worker
                  .toPdf()
                  .get("pdf")
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .then((pdf: any) => {
                    pdf.addPage();
                    return pdf;
                  })
                  .from(scene)
                  .toContainer()
                  .toCanvas()
                  .toPdf();
              }

              await worker.save();
            } catch (err) {
              console.error("[usePdfExport] html2pdf.js canvas export failed:", err);
              reject(err instanceof Error ? err : new Error(String(err)));
            } finally {
              document.body.classList.remove("printing");
              document.documentElement.classList.remove("printing");
              setPrinting(false);
              resolve();
            }
          });
        });
      });
    }

    // ── Path A — window.print() (default) ─────────────────────────────
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
