/**
 * visual-self-check.ts — layout / typography auto-audit.
 *
 * Walks every (chapter, step) in CHAPTERS, opens it in headless Chromium
 * via Playwright, and checks:
 *
 *   • main visible font size px (warn < 24px, fail < 16px)
 *   • text overflow inside .stage-frame (scrollWidth/Height > offset*)
 *   • PageNumber renders right-bottom on hover (manual mode)
 *   • SubtitleBar shows `narrations[step]` verbatim
 *   • `?subs=off` hides the SubtitleBar (sampled on the first step)
 *
 * Each step is screenshotted (with `?recording=1` so chrome is stripped)
 * to `self-check-screenshots/<chapter>-<step>.png`. A human-readable
 * `self-check-report.html` and a machine-readable `self-check-report.json`
 * are written to the project root.
 *
 * Run via:    npm run self-check
 * Override port:  SELF_CHECK_PORT=5181 npm run self-check
 *
 * Fallback notes (spec §10 risk table):
 *   • If Playwright fails to install browsers, swap to
 *     `puppeteer-core` + a local Chrome (CHROME_PATH=...) — the
 *     measurement / screenshot calls map 1:1.
 *   • Extreme fallback: vitest + jsdom for the font-size / overflow
 *     metrics only (screenshots are dropped).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const REGISTRY_PATH = join(ROOT, "src/registry/chapters.ts");
const CHAPTERS_DIR = join(ROOT, "src/chapters");
const SCREENSHOT_DIR = join(ROOT, "self-check-screenshots");
const REPORT_HTML = join(ROOT, "self-check-report.html");
const REPORT_JSON = join(ROOT, "self-check-report.json");

const DEV_PORT = Number(process.env.SELF_CHECK_PORT ?? 5179);
const BASE_URL = `http://localhost:${DEV_PORT}`;
const VIEWPORT = { width: 1920, height: 1080 };

const WARN_FONT_PX = 24;
const FAIL_FONT_PX = 16;

type Severity = "ok" | "warn" | "fail";

interface Finding {
  level: Severity;
  message: string;
}

interface StepResult {
  chapterId: string;
  chapterIdx: number;
  stepIdx: number;
  pageLabel: string; // human "C.S" form (1-indexed)
  narration: string;
  url: string;
  screenshot: string; // relative to ROOT
  largestVisibleFontPx: number;
  hasOverflow: boolean;
  pageNumberOk: boolean | null;
  subtitleVisible: boolean;
  subtitleTextMatches: boolean;
  subsOffHides: boolean | null; // sampled (only on first step of each chapter)
  findings: Finding[];
}

// ─────────────────────────────────────────────────────────────────────
// 1. Discover chapters (id + narrations) from the project filesystem.
// ─────────────────────────────────────────────────────────────────────
async function discoverChapters(): Promise<
  { id: string; folder: string; narrations: string[] }[]
> {
  const src = await readFile(REGISTRY_PATH, "utf8");
  const ids = [...src.matchAll(/\bid:\s*["']([^"']+)["']/g)].map(
    (m) => m[1] as string,
  );
  const folders: string[] = [
    ...src.matchAll(/from\s+["']\.\.\/chapters\/([^"'\/]+)\/narrations["']/g),
  ].map((m) => m[1] as string);

  const out: { id: string; folder: string; narrations: string[] }[] = [];
  for (const id of ids) {
    const folder =
      folders.find((f) => f.endsWith(`-${id}`)) ??
      folders.find((f) => f === id);
    if (!folder) {
      throw new Error(
        `chapter id "${id}" registered in chapters.ts but no matching ` +
          `folder under src/chapters/`,
      );
    }
    const file = join(CHAPTERS_DIR, folder, "narrations.ts");
    if (!existsSync(file)) {
      throw new Error(`missing narrations.ts: ${file}`);
    }
    const mod = await import(pathToFileURL(file).href);
    if (!Array.isArray(mod.narrations)) {
      throw new Error(
        `narrations.ts in ${folder} must export an array named "narrations"`,
      );
    }
    out.push({ id, folder, narrations: mod.narrations as string[] });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Boot the dev server in the background, kill it on cleanup.
// ─────────────────────────────────────────────────────────────────────
function bootDevServer(): Promise<ChildProcess> {
  return new Promise((res, rej) => {
    const child = spawn(
      "npx",
      ["vite", "--port", String(DEV_PORT), "--strictPort"],
      {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0", BROWSER: "none" },
      },
    );
    let ready = false;
    const onChunk = (b: Buffer) => {
      const s = b.toString();
      // Vite prints "ready in <ms>" or a "Local:" URL line.
      if (!ready && (/ready in/i.test(s) || /Local:\s+http/i.test(s))) {
        ready = true;
        res(child);
      }
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("error", rej);
    setTimeout(() => {
      if (!ready) {
        try {
          child.kill("SIGTERM");
        } catch {
          /* noop */
        }
        rej(new Error(`dev server didn't become ready within 30s`));
      }
    }, 30_000);
  });
}

// ─────────────────────────────────────────────────────────────────────
// 3. Per-step measurement (runs inside the browser).
// ─────────────────────────────────────────────────────────────────────
async function measureStep(page: Page) {
  return await page.evaluate(() => {
    // Find every visible element with rendered text and pick the largest
    // font size among them. We deliberately scope to the stage so chrome
    // chrome elements (badges, hover menus) don't skew the result.
    const root =
      (document.querySelector(".stage-frame") as HTMLElement | null) ??
      document.body;
    let largest = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as HTMLElement | null;
    while (node) {
      if (node.innerText && node.innerText.trim().length > 0) {
        // Skip elements without their own text (only descendants' text)
        const ownText = Array.from(node.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? "")
          .join("")
          .trim();
        if (ownText.length > 0) {
          const cs = window.getComputedStyle(node);
          const px = parseFloat(cs.fontSize);
          if (px > largest) largest = px;
        }
      }
      node = walker.nextNode() as HTMLElement | null;
    }

    // Overflow check on the stage frame itself (chapters are absolute-
    // positioned inside the 1920×1080 box; anything wider/taller leaks).
    const stage = document.querySelector(".stage-frame") as HTMLElement | null;
    const overflow = stage
      ? stage.scrollWidth > stage.offsetWidth + 1 ||
        stage.scrollHeight > stage.offsetHeight + 1
      : false;

    // SubtitleBar — present? text?
    const subBar = document.querySelector(".sub-bar") as HTMLElement | null;
    const subText =
      (document.querySelector(".sub-bar-text") as HTMLElement | null)
        ?.innerText ?? "";

    return {
      largestVisibleFontPx: largest,
      hasOverflow: overflow,
      subBarVisible: subBar !== null,
      subBarText: subText,
    };
  });
}

async function checkPageNumberAfterHover(page: Page) {
  // Trigger hover (PageNumber fades in 200ms after pointer enters stage).
  const stage = page.locator(".stage-frame");
  await stage.hover().catch(() => {});
  await page.waitForTimeout(400);

  return await page.evaluate(() => {
    const badge = document.querySelector(".pn") as HTMLElement | null;
    if (!badge) return { rendered: false, bottomRightOk: false, text: "" };
    const r = badge.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // "right-bottom 24px inset" tolerance: allow up to 96px from each edge
    // (typography padding + sub-bar safe-area can push it inward in cover
    // mode; we want to catch "stuck top-left" mistakes, not pixel-perfect
    // calibration which is the theme's job).
    const bottomRightOk =
      vw - r.right < 120 && vh - r.bottom < 120;
    return {
      rendered: true,
      bottomRightOk,
      text: badge.innerText.trim(),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────
// 4. Per-step finding aggregator.
// ─────────────────────────────────────────────────────────────────────
function buildFindings(
  m: Awaited<ReturnType<typeof measureStep>>,
  expectedNarration: string,
  pn: { rendered: boolean; bottomRightOk: boolean; text: string } | null,
  subsOffHides: boolean | null,
  expectedPageLabel: string,
): Finding[] {
  const findings: Finding[] = [];

  if (m.largestVisibleFontPx === 0) {
    findings.push({
      level: "fail",
      message:
        "no visible text found inside .stage-frame (empty step? render error?)",
    });
  } else if (m.largestVisibleFontPx < FAIL_FONT_PX) {
    findings.push({
      level: "fail",
      message: `largest visible font ${m.largestVisibleFontPx.toFixed(
        1,
      )}px < red line ${FAIL_FONT_PX}px`,
    });
  } else if (m.largestVisibleFontPx < WARN_FONT_PX) {
    findings.push({
      level: "warn",
      message: `largest visible font ${m.largestVisibleFontPx.toFixed(
        1,
      )}px < warn ${WARN_FONT_PX}px`,
    });
  }

  if (m.hasOverflow) {
    findings.push({
      level: "fail",
      message:
        "text overflows .stage-frame (scrollWidth/Height > offsetWidth/Height)",
    });
  }

  // SubtitleBar correctness (in recording mode, subtitle MUST still show).
  if (expectedNarration.trim().length > 0) {
    if (!m.subBarVisible) {
      findings.push({
        level: "fail",
        message: "SubtitleBar missing while narration is non-empty",
      });
    } else if (m.subBarText.trim() !== expectedNarration.trim()) {
      findings.push({
        level: "warn",
        message: `SubtitleBar text mismatch — saw "${m.subBarText}", expected "${expectedNarration}"`,
      });
    }
  }

  // PageNumber (only sampled when we did the hover pass).
  if (pn) {
    if (!pn.rendered) {
      findings.push({
        level: "fail",
        message: "PageNumber did not render after stage hover (manual mode)",
      });
    } else {
      if (!pn.bottomRightOk) {
        findings.push({
          level: "warn",
          message: "PageNumber not anchored near bottom-right (drifted > 120px)",
        });
      }
      if (pn.text && pn.text !== expectedPageLabel) {
        findings.push({
          level: "warn",
          message: `PageNumber label "${pn.text}" ≠ expected "${expectedPageLabel}"`,
        });
      }
    }
  }

  // ?subs=off sanity (only sampled once per chapter).
  if (subsOffHides === false) {
    findings.push({
      level: "fail",
      message: "?subs=off failed to hide SubtitleBar",
    });
  }

  if (findings.length === 0) {
    findings.push({ level: "ok", message: "all checks passed" });
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────
// 5. Run.
// ─────────────────────────────────────────────────────────────────────
async function ensureChromium(): Promise<void> {
  // Cheap probe: try executablePath(). If Playwright didn't install the
  // browser binary yet, fall back to invoking `npx playwright install
  // chromium`. This keeps the developer experience to "npm run self-check"
  // even on a fresh clone.
  try {
    const path = chromium.executablePath();
    if (path && existsSync(path)) return;
  } catch {
    /* fall through to install */
  }
  console.error("▸ Chromium binary missing; running `playwright install chromium`…");
  await new Promise<void>((res, rej) => {
    const p = spawn("npx", ["playwright", "install", "chromium"], {
      stdio: "inherit",
    });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`exit ${code}`))));
  });
}

async function main() {
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.error("▸ Discovering chapters…");
  const chapters = await discoverChapters();
  const totalSteps = chapters.reduce((s, c) => s + c.narrations.length, 0);
  console.error(
    `  found ${chapters.length} chapters, ${totalSteps} steps total`,
  );

  await ensureChromium();

  console.error("▸ Booting dev server on port", DEV_PORT, "…");
  const server = await bootDevServer();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const results: StepResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: VIEWPORT });

    for (let ci = 0; ci < chapters.length; ci++) {
      const chap = chapters[ci]!;
      for (let si = 0; si < chap.narrations.length; si++) {
        const narration = chap.narrations[si] ?? "";
        const pageLabel = `${ci + 1}.${si + 1}`;
        const recordingUrl =
          `${BASE_URL}/?chapter=${ci}&step=${si}&recording=1`;
        const manualUrl = `${BASE_URL}/?chapter=${ci}&step=${si}`;
        const subsOffUrl = `${BASE_URL}/?chapter=${ci}&step=${si}&subs=off`;

        const page = await context.newPage();
        // Pass 1 — recording mode: clean chrome → screenshot + measure.
        await page.goto(recordingUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(250); // let entry animations settle
        const m = await measureStep(page);
        const screenshotRel = `self-check-screenshots/${chap.id}-${si + 1}.png`;
        await page.screenshot({
          path: join(ROOT, screenshotRel),
          fullPage: false,
        });

        // Pass 2 — manual mode: hover stage → check PageNumber.
        await page.goto(manualUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(200);
        const pn = await checkPageNumberAfterHover(page);

        // Pass 3 — subs=off sanity (only on first step of each chapter to
        // keep total runtime reasonable on large decks).
        let subsOffHides: boolean | null = null;
        if (si === 0) {
          await page.goto(subsOffUrl, { waitUntil: "networkidle" });
          await page.waitForTimeout(150);
          subsOffHides = await page.evaluate(
            () => document.querySelector(".sub-bar") === null,
          );
        }

        const findings = buildFindings(m, narration, pn, subsOffHides, pageLabel);

        results.push({
          chapterId: chap.id,
          chapterIdx: ci,
          stepIdx: si,
          pageLabel,
          narration,
          url: recordingUrl,
          screenshot: screenshotRel,
          largestVisibleFontPx: m.largestVisibleFontPx,
          hasOverflow: m.hasOverflow,
          pageNumberOk: pn ? pn.bottomRightOk && pn.rendered : null,
          subtitleVisible: m.subBarVisible,
          subtitleTextMatches:
            narration.trim().length === 0
              ? true
              : m.subBarText.trim() === narration.trim(),
          subsOffHides,
          findings,
        });
        await page.close();

        const worst = worstLevel(findings);
        const tag = worst === "fail" ? "✗" : worst === "warn" ? "△" : "✓";
        console.error(
          `  ${tag} ${chap.id}/${pageLabel}  ` +
            `font=${m.largestVisibleFontPx.toFixed(0)}px ` +
            `${m.hasOverflow ? "OVERFLOW " : ""}` +
            findings
              .filter((f) => f.level !== "ok")
              .map((f) => `[${f.level}] ${f.message}`)
              .join("  "),
        );
      }
    }
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    try {
      server.kill("SIGTERM");
    } catch {
      /* noop */
    }
  }

  writeFileSync(REPORT_JSON, JSON.stringify(results, null, 2) + "\n", "utf8");
  writeFileSync(REPORT_HTML, renderHtml(results), "utf8");

  const totals = tally(results);
  console.error("");
  console.error(
    `▸ Wrote ${REPORT_JSON} + ${REPORT_HTML} ` +
      `(ok=${totals.ok}  warn=${totals.warn}  fail=${totals.fail})`,
  );
  if (totals.fail > 0) {
    console.error("✗ red-line failures present — fix before D2 sign-off.");
    process.exit(1);
  }
  if (totals.warn > 0) {
    console.error(
      "△ warnings present — allowed for D2 but record in progress.md.",
    );
  }
}

function worstLevel(findings: Finding[]): Severity {
  if (findings.some((f) => f.level === "fail")) return "fail";
  if (findings.some((f) => f.level === "warn")) return "warn";
  return "ok";
}

function tally(rs: StepResult[]) {
  let ok = 0,
    warn = 0,
    fail = 0;
  for (const r of rs) {
    const w = worstLevel(r.findings);
    if (w === "fail") fail++;
    else if (w === "warn") warn++;
    else ok++;
  }
  return { ok, warn, fail };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}

function renderHtml(rs: StepResult[]): string {
  const totals = tally(rs);
  const rows = rs
    .map((r) => {
      const worst = worstLevel(r.findings);
      const cls =
        worst === "fail" ? "row-fail" : worst === "warn" ? "row-warn" : "row-ok";
      return `<tr class="${cls}">
        <td><code>${esc(r.pageLabel)}</code><br><small>${esc(r.chapterId)}</small></td>
        <td><img src="${esc(r.screenshot)}" loading="lazy" /></td>
        <td>${esc(r.narration || "(silent)")}</td>
        <td>${r.largestVisibleFontPx.toFixed(0)}px</td>
        <td>${r.hasOverflow ? "yes" : "no"}</td>
        <td>${r.pageNumberOk === null ? "—" : r.pageNumberOk ? "ok" : "off"}</td>
        <td>${r.subtitleVisible ? (r.subtitleTextMatches ? "ok" : "mismatch") : "hidden"}</td>
        <td>${r.findings.map((f) => `<div class="f f-${f.level}">${esc(f.message)}</div>`).join("")}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>visual self-check report</title>
<style>
  body { font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .summary { color: #555; margin-bottom: 16px; }
  .summary .pill { display: inline-block; margin-right: 8px; padding: 2px 10px; border-radius: 999px; font-weight: 600; }
  .pill-ok   { background: #d8f3dc; color: #1b4332; }
  .pill-warn { background: #ffe8a3; color: #614400; }
  .pill-fail { background: #ffd0d0; color: #6e0000; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #eee; padding: 8px; vertical-align: top; text-align: left; }
  th { background: #fafafa; position: sticky; top: 0; }
  td img { max-width: 320px; height: auto; border: 1px solid #ddd; }
  .row-fail { background: #fff5f5; }
  .row-warn { background: #fffaf0; }
  .f { padding: 2px 0; }
  .f-fail { color: #b40000; font-weight: 600; }
  .f-warn { color: #8a6500; }
  .f-ok   { color: #1b4332; }
  code { font-family: ui-monospace, monospace; }
</style>
</head>
<body>
<h1>visual self-check</h1>
<div class="summary">
  <span class="pill pill-ok">ok ${totals.ok}</span>
  <span class="pill pill-warn">warn ${totals.warn}</span>
  <span class="pill pill-fail">fail ${totals.fail}</span>
  &middot; warn = font &lt; ${WARN_FONT_PX}px &middot; fail = font &lt; ${FAIL_FONT_PX}px or overflow
</div>
<table>
  <thead>
    <tr><th>Page</th><th>Screenshot</th><th>Narration</th><th>Largest font</th><th>Overflow</th><th>PageNumber</th><th>Subtitle</th><th>Findings</th></tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
</body>
</html>
`;
}

main().catch((err) => {
  console.error("✗ self-check crashed:", err);
  process.exit(2);
});
