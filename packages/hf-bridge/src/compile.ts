import { mkdirSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function copyLocalGsap(outputDir: string): void {
  const src = require.resolve("gsap/dist/gsap.min.js");
  const dest = join(outputDir, "assets", "gsap.min.js");
  mkdirSync(join(outputDir, "assets"), { recursive: true });
  cpSync(src, dest);
}
import type { CourseComposition, VisualElement } from "@courseflow/core";
import {
  flexJustifyForTextAlign,
  getOrderedSteps,
  isChapterStep,
  resolveSubtitleDisplayText,
  resolveSubtitleStyle,
  resolveTextLineHeightPx,
  subtitleOverlayInlineCss,
  visualTextFlexAlignItems,
  VISUAL_TEXT_PADDING_PX,
} from "@courseflow/core";
import { buildThemeStylesCssForRender, toHyperframesFontFamily } from "./hyperframes-fonts.js";

const COMPOSITION_ID = "courseflow-export";

export interface HyperFramesProject {
  dir: string;
  indexPath: string;
  totalDurationSec: number;
}

export interface CompileOptions {
  /** 使用本機 assets/ 相對路徑，供 worker 離線渲染 */
  localAssets?: boolean;
  /** 是否在匯出影片中燒錄字幕（預設 false；本專案 v2 不提供字幕） */
  includeSubtitles?: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assetFileName(storagePath: string): string {
  return storagePath.split("/").pop() ?? storagePath;
}

function resolveAudioSrc(stepId: string, publicUrl: string | undefined, localAssets: boolean): string {
  if (localAssets) return `assets/audio/${stepId}.mp3`;
  return publicUrl ?? "";
}

function resolveImageSrc(storagePath: string, publicUrl: string | undefined, localAssets: boolean): string {
  if (localAssets) return `assets/images/${assetFileName(storagePath)}`;
  return publicUrl ?? `assets/images/${assetFileName(storagePath)}`;
}

function renderElement(el: VisualElement, themeActive: boolean, localAssets: boolean): string {
  if (el.type === "image") {
    const src = resolveImageSrc(el.storagePath, el.publicUrl, localAssets);
    return `<img id="${el.id}" src="${escapeHtml(src)}" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;opacity:${el.opacity};object-fit:contain;z-index:${el.zIndex}" />`;
  }
  const isHero = el.id.endsWith("-hero");
  const cls = themeActive ? (isHero ? "visual-text hero-num serif-cn" : "visual-text") : "visual-text";
  const lineHeight = resolveTextLineHeightPx(el);
  const alignItems = visualTextFlexAlignItems(el);
  const justifyContent = flexJustifyForTextAlign(el.textAlign);
  const shared = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;font-size:${el.fontSizePx}px;line-height:${lineHeight}px;text-align:${el.textAlign};z-index:${el.zIndex};display:flex;align-items:${alignItems};justify-content:${justifyContent};padding:${VISUAL_TEXT_PADDING_PX}px;box-sizing:border-box;white-space:pre-wrap;word-break:break-word;overflow:hidden;`;
  const hfFont = toHyperframesFontFamily(el.fontFamily);
  const style = themeActive
    ? shared
    : `${shared}font-family:${hfFont},sans-serif;color:${el.color};`;
  return `<div id="${el.id}" class="${cls}" style="${style}">${escapeHtml(el.content)}</div>`;
}

function stepDurationSec(composition: CourseComposition, stepId: string, _fallbackSec?: number): number {
  const audio = composition.audio.find((a) => a.stepId === stepId);
  if (audio?.durationMs && audio.durationMs > 0) {
    return Math.max(1, audio.durationMs / 1000);
  }
  return 5;
}

export function compileToHyperFrames(
  composition: CourseComposition,
  outputDir: string,
  options: CompileOptions = {},
): HyperFramesProject {
  const localAssets = options.localAssets ?? false;
  const includeSubtitles = options.includeSubtitles === true;
  mkdirSync(join(outputDir, "assets", "audio"), { recursive: true });
  mkdirSync(join(outputDir, "assets", "images"), { recursive: true });
  if (localAssets) {
    copyLocalGsap(outputDir);
  }

  const ordered = getOrderedSteps(composition);
  let cursor = 0;
  const enterIds: string[] = [];
  const sceneLayers: string[] = [];
  const audioClips: string[] = [];

  ordered.forEach((step, i) => {
    const durationSec = stepDurationSec(composition, step.id, step.estimatedSeconds);
    const start = cursor;
    cursor += durationSec;

    const visual = composition.visuals.find((v) => v.stepId === step.id);
    const audio = composition.audio.find((a) => a.stepId === step.id);
    const subtitle = composition.subtitles.find((s) => s.stepId === step.id);
    enterIds.push(visual?.enterAnimationId ?? "fade-up");

    const bg = visual?.background;
    const themeActive = Boolean(composition.meta.themeId);
    let bgCss = "";
    if (bg?.type === "image" && (bg.storagePath || bg.publicUrl)) {
      const bgSrc = bg.storagePath
        ? resolveImageSrc(bg.storagePath, bg.publicUrl, localAssets)
        : (bg.publicUrl ?? "");
      bgCss = `background-image:url('${escapeHtml(bgSrc)}');background-size:cover;background-position:center;opacity:${bg.opacity};`;
    } else if (!themeActive) {
      bgCss = `background-color:${bg?.color ?? "#1a1a2e"};`;
    }

    const els = (visual?.elements ?? [])
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((el) => renderElement(el, themeActive, localAssets))
      .join("");

    const captionText =
      includeSubtitles && subtitle && !isChapterStep(step)
        ? resolveSubtitleDisplayText(subtitle.segments, step.script ?? "")
        : "";
    let captionHtml = "";
    if (captionText && subtitle) {
      const resolvedSub = resolveSubtitleStyle(subtitle.style);
      const captionStyle = subtitleOverlayInlineCss(resolvedSub, subtitle.position).replace(
        /font-family:[^;]+/,
        `font-family:${toHyperframesFontFamily(resolvedSub.fontFamily)},sans-serif`,
      );
      captionHtml = `<div class="caption" style="${captionStyle}">${escapeHtml(captionText)}</div>`;
    }

    sceneLayers.push(`<div id="scene-${i}" class="scene" style="${bgCss}${i > 0 ? "opacity:0;" : ""}">
      ${els}
      ${captionHtml}
    </div>`);

    const audioSrc = audio ? resolveAudioSrc(step.id, audio.publicUrl, localAssets) : "";
    if (audioSrc) {
      audioClips.push(
        `<audio id="audio-${i}" data-start="${start}" data-duration="${durationSec}" data-track-index="1" src="${escapeHtml(audioSrc)}"></audio>`,
      );
    }
  });

  const totalDurationSec = cursor;
  const bgm = composition.bgm;
  const bgmClip =
    bgm.storagePath || bgm.publicUrl
      ? `<audio id="bgm" data-start="0" data-duration="${totalDurationSec}" data-track-index="2" data-volume="${bgm.volume}" src="${escapeHtml(localAssets ? "assets/bgm.mp3" : (bgm.publicUrl ?? "assets/bgm.mp3"))}"></audio>`
      : "";

  const themeActive = Boolean(composition.meta.themeId);
  const themeStyles = composition.meta.themeId
    ? buildThemeStylesCssForRender(composition.meta.themeId) ?? ""
    : "";

  const indexPath = join(outputDir, "index.html");
  const html = `<!DOCTYPE html>
<html lang="${composition.meta.language}">
<head>
  <meta charset="UTF-8" />
  <title>CourseFlow Export</title>
  <script src="${localAssets ? "assets/gsap.min.js" : "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"}"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--shell, #000); }
    .scene { position: absolute; inset: 0; width: 1920px; height: 1080px; overflow: hidden; }
    .visual-text { position: absolute; }
    .caption { position: absolute; z-index: 100; }
    ${themeActive ? "#root.stage-frame { background: var(--surface, transparent); }" : ""}
    ${themeStyles ?? ""}
  </style>
</head>
<body>
  <div id="root" class="${themeActive ? "stage-frame" : ""}"
       data-composition-id="${COMPOSITION_ID}"
       data-width="1920"
       data-height="1080"
       data-start="0"
       data-duration="${totalDurationSec}">
    ${sceneLayers.join("\n")}
    ${audioClips.join("\n")}
    ${bgmClip}
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    const enterIds = ${JSON.stringify(enterIds)};
    const enterVars = {
      "fade-up": { opacity: 0, y: 30 },
      "fade-in": { opacity: 0 },
      "scale-in": { opacity: 0, scale: 0.85 },
      "slide-left": { opacity: 0, x: -80 },
      "blur-in": { opacity: 0 },
    };
    let sceneStart = 0;
    ${ordered
      .map((step, i) => {
        const dur = stepDurationSec(composition, step.id, step.estimatedSeconds);
        const block = `
    (function() {
      const scene = document.getElementById("scene-${i}");
      const from = enterVars[enterIds[${i}]] || enterVars["fade-up"];
      if (${i} > 0) {
        tl.set(document.getElementById("scene-${i - 1}"), { opacity: 0 }, sceneStart);
        tl.set(scene, { opacity: 1 }, sceneStart);
      }
      tl.from(scene.querySelectorAll(".visual-text, img"), { ...from, duration: 0.7, ease: "power2.out", stagger: 0.08 }, sceneStart + 0.05);
    })();`;
        const next = `sceneStart += ${dur};`;
        return block + next;
      })
      .join("\n")}
    window.__timelines["${COMPOSITION_ID}"] = tl;
  </script>
</body>
</html>`;

  writeFileSync(indexPath, html, "utf8");

  writeFileSync(
    join(outputDir, "hyperframes.json"),
    JSON.stringify({ name: COMPOSITION_ID, version: 1 }, null, 2),
  );

  return { dir: outputDir, indexPath, totalDurationSec };
}

export async function copyCompositionAssets(
  composition: CourseComposition,
  outputDir: string,
  resolvePath: (storagePath: string) => string,
): Promise<void> {
  for (const a of composition.audio) {
    const src = resolvePath(a.storagePath);
    if (existsSync(src)) {
      cpSync(src, join(outputDir, "assets", "audio", `${a.stepId}.mp3`));
    }
  }
  for (const v of composition.visuals) {
    for (const el of v.elements) {
      if (el.type === "image" && el.storagePath) {
        const src = resolvePath(el.storagePath);
        if (existsSync(src)) {
          cpSync(src, join(outputDir, "assets", "images", assetFileName(el.storagePath)));
        }
      }
    }
    if (v.background.storagePath) {
      const src = resolvePath(v.background.storagePath);
      if (existsSync(src)) {
        cpSync(src, join(outputDir, "assets", "images", assetFileName(v.background.storagePath)));
      }
    }
  }
  if (composition.bgm.storagePath) {
    const src = resolvePath(composition.bgm.storagePath);
    if (existsSync(src)) cpSync(src, join(outputDir, "assets", "bgm.mp3"));
  }
}
