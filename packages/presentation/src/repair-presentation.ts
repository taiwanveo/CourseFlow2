import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { WVP_TEMPLATES_DIR } from "./vendor-paths.js";
import { generateChapterSources } from "./codegen/chapter.js";

function truncateForBeat(s: string): string {
  const t = s.trim();
  return t.length <= 48 ? t : `${t.slice(0, 47)}…`;
}
import { writeChapterSourcesRaw } from "./write-sources.js";
import { needsChapterContentUpgrade } from "./visual-demo.js";

async function copyIfMissing(from: string, to: string) {
  try {
    await access(to);
  } catch {
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to);
  }
}

/** 既有 presentation 補上 Framer Motion 依賴（新 scaffold 已內建） */
async function ensurePresentationPackageDeps(presentationDir: string): Promise<void> {
  const pkgPath = join(presentationDir, "package.json");
  let raw: string;
  try {
    raw = await readFile(pkgPath, "utf8");
  } catch {
    return;
  }
  const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
  const deps = pkg.dependencies ?? {};
  if (deps["framer-motion"]) return;
  deps["framer-motion"] = "^12.40.0";
  pkg.dependencies = deps;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** 建置前：Studio 預覽放大舞台、補齊視覺元件、缺演示的章節回退增強模板 */
export async function repairPresentationBeforeBuild(presentationDir: string): Promise<{
  stageScalePatched: boolean;
  vizComponentAdded: boolean;
  chaptersUpgraded: string[];
}> {
  const t = WVP_TEMPLATES_DIR;
  const hooksDir = join(presentationDir, "src", "hooks");
  const componentsDir = join(presentationDir, "src", "components");

  const libDir = join(presentationDir, "src", "lib");
  await mkdir(hooksDir, { recursive: true });
  await mkdir(libDir, { recursive: true });
  await mkdir(componentsDir, { recursive: true });
  await ensurePresentationPackageDeps(presentationDir);

  const scaleSrc = join(t, "src/hooks/useStageScale.ts");
  const scaleDst = join(hooksDir, "useStageScale.ts");
  await cp(scaleSrc, scaleDst, { force: true });
  for (const hook of [
    "useStepper.ts",
    "useAutoMode.ts",
    "usePlayControlBridge.ts",
    "useAudioRevision.ts",
    "useAudioPlayer.ts",
    "usePresentationMotion.ts",
    "usePauseControl.ts",
    "fitStageText.ts",
  ]) {
    await cp(join(t, "src/hooks", hook), join(hooksDir, hook), { force: true });
  }
  await cp(join(t, "src/App.tsx"), join(presentationDir, "src/App.tsx"), { force: true });
  await cp(join(t, "src/lib/imageLayout.ts"), join(libDir, "imageLayout.ts"), {
    force: true,
  });
  for (const css of [
    "base.css",
    "animations.css",
    "asian-slide-design.css",
    "stage-text-fit.css",
    "image-layout.css",
  ]) {
    await cp(join(t, "src/styles", css), join(presentationDir, "src/styles", css), {
      force: true,
    });
  }
  await cp(join(t, "src/components/MaskReveal.tsx"), join(componentsDir, "MaskReveal.tsx"), {
    force: true,
  });
  for (const name of [
    "StageNav.tsx",
    "StageNav.css",
    "ChapterFigure.tsx",
    "ChapterFigure.css",
    "NarrationBeat.tsx",
    "NarrationBeat.css",
    "AutoStartGate.tsx",
    "AutoStartGate.css",
  ]) {
    await cp(join(t, "src/components", name), join(componentsDir, name), { force: true });
  }

  for (const name of [
    "motion-presets.ts",
    "explain-motion-types.ts",
    "ExplainMotionScene.tsx",
    "ExplainMotionScene.css",
    "ExplainAnimationSlot.tsx",
    "MaskReveal.tsx",
    "SafeAnimationFrame.tsx",
    "SafeAnimationFrame.css",
    "ListRevealGrid.tsx",
    "ListRevealGrid.css",
    "FlowDiagram.tsx",
    "FlowDiagram.css",
    "ChapterFigure.tsx",
    "ChapterFigure.css",
    "HookImageStrip.tsx",
    "HookImageStrip.css",
    "BeatSceneStep.tsx",
    "BeatSceneStep.css",
    "VisualBlock.tsx",
    "VisualBlock.css",
    "step-dsl-types.ts",
    "UniversalStepChapter.tsx",
    "UniversalStepChapter.css",
    "StepTransitionFrame.tsx",
    "StepEnterFrame.tsx",
    "step-dsl-runtime.ts",
  ]) {
    await cp(join(t, "src/components", name), join(componentsDir, name), { force: true });
  }
  const visualNames = [
    "ChartRenderer.tsx",
    "ChartRenderer.css",
    "TableRenderer.tsx",
    "TableRenderer.css",
    "table-utils.ts",
    "AnimationRenderer.tsx",
    "AnimationRenderer.css",
  ];
  await mkdir(join(componentsDir, "visual"), { recursive: true });
  for (const name of visualNames) {
    await cp(
      join(t, "src/components/visual", name),
      join(componentsDir, "visual", name),
      { force: true },
    );
  }

  const chaptersUpgraded: string[] = [];
  const chaptersRoot = join(presentationDir, "src", "chapters");
  let folderNames: string[];
  try {
    folderNames = await readdir(chaptersRoot);
  } catch {
    return { stageScalePatched: true, vizComponentAdded: true, chaptersUpgraded };
  }

  for (const folderName of folderNames) {
    if (folderName === "01-example" || folderName.startsWith(".")) continue;
    const dir = join(chaptersRoot, folderName);
    const files = await readdir(dir);
    const tsxFile = files.find((f) => f.endsWith(".tsx"));
    if (!tsxFile) continue;
    const componentName = tsxFile.replace(/\.tsx$/, "");
    const tsxPath = join(dir, tsxFile);
    const cssPath = join(dir, `${componentName}.css`);
    const narrPath = join(dir, "narrations.ts");

    let narrations: string[] = [];
    try {
      const narrSrc = await readFile(narrPath, "utf8");
      for (const hit of narrSrc.matchAll(/^\s+("(?:\\.|[^"\\])*"),/gm)) {
        narrations.push(JSON.parse(hit[1]!) as string);
      }
    } catch {
      continue;
    }
    if (narrations.length === 0) continue;

    let tsx = await readFile(tsxPath, "utf8");
    let css = "";
    try {
      css = await readFile(cssPath, "utf8");
    } catch {
      /* empty */
    }

    if (!needsChapterContentUpgrade(tsx, css, narrations)) continue;

    const wvpId = folderName.replace(/^\d+-/, "") || folderName;
    const titleMatch = tsx.match(/className="brand"[^>]*>([^<]+)</);
    const title = titleMatch?.[1]?.trim() || wvpId;

    let forceTemplate: import("@courseflow/core").WvpChapterKind | undefined;
    if (/ListRevealGrid/.test(tsx)) forceTemplate = "list-reveal";
    else if (/FlowDiagram/.test(tsx)) forceTemplate = "flow";
    else if (/HookImageStrip/.test(tsx)) forceTemplate = "hook";
    else if (/VisualBlock/.test(tsx)) forceTemplate = "magazine";

    const generated = generateChapterSources({
      folderName,
      wvpChapterId: wvpId,
      title,
      narrations,
      forceTemplate,
      stepBeats: narrations.map((_, i) => ({
        step: i,
        dominantAction: truncateForBeat(narrations[i] ?? ""),
      })),
    });

    await writeChapterSourcesRaw(presentationDir, {
      folderName,
      componentName,
      narrations,
      chapterTsx: generated.tsx,
      chapterCss: generated.css,
    });
    chaptersUpgraded.push(folderName);
  }

  return {
    stageScalePatched: true,
    vizComponentAdded: true,
    chaptersUpgraded,
  };
}
