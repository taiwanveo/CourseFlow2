import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { themeTokensPath, WVP_TEMPLATES_DIR } from "./vendor-paths.js";

const PRESENTATION_PACKAGE_JSON = {
  name: "courseflow-wvp-presentation",
  private: true,
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    "extract-narrations": "tsx scripts/extract-narrations.ts",
    "synthesize-audio": "bash scripts/synthesize-audio.sh",
  },
  dependencies: {
    react: "^19.1.0",
    "react-dom": "^19.1.0",
    recharts: "^2.15.3",
  },
  devDependencies: {
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    typescript: "^5.8.3",
    vite: "^6.3.5",
    tsx: "^4.19.4",
  },
} as const;

const PRESENTATION_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    skipLibCheck: true,
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    types: ["vite/client"],
  },
  include: ["src"],
} as const;

async function copyFile(from: string, to: string) {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to);
}

export interface ScaffoldResult {
  presentationDir: string;
  themeId: string;
}

/**
 * 將 WVP Vite 模板複製到 targetDir（不跑 npm create vite，由 build 階段 install）。
 */
export async function scaffoldPresentation(
  targetDir: string,
  themeId: string,
): Promise<ScaffoldResult> {
  let resolvedTheme = themeId;
  let tokensSrc = themeTokensPath(themeId);
  try {
    await access(tokensSrc);
  } catch {
    resolvedTheme = "midnight-press";
    tokensSrc = themeTokensPath(resolvedTheme);
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const t = WVP_TEMPLATES_DIR;
  const dirs = [
    "src/styles",
    "src/hooks",
    "src/components",
    "src/registry",
    "src/chapters/01-example",
    "public",
    "public/audio",
    "scripts",
  ];
  for (const d of dirs) {
    await mkdir(join(targetDir, d), { recursive: true });
  }

  await copyFile(join(t, "vite.config.ts"), join(targetDir, "vite.config.ts"));
  await copyFile(join(t, "index.html"), join(targetDir, "index.html"));
  await copyFile(join(t, "src/main.tsx"), join(targetDir, "src/main.tsx"));
  await copyFile(join(t, "src/App.tsx"), join(targetDir, "src/App.tsx"));

  await copyFile(tokensSrc, join(targetDir, "src/styles/tokens.css"));
  for (const css of ["base.css", "animations.css", "fonts.css"]) {
    await copyFile(join(t, "src/styles", css), join(targetDir, "src/styles", css));
  }

  for (const hook of [
    "useStageScale.ts",
    "useStepper.ts",
    "useAudioPlayer.ts",
    "useAutoMode.ts",
    "usePlayControlBridge.ts",
  ]) {
    await copyFile(join(t, "src/hooks", hook), join(targetDir, "src/hooks", hook));
  }

  const componentFiles = [
    "Stage.tsx",
    "MaskReveal.tsx",
    "NarrationBeat.tsx",
    "NarrationBeat.css",
    "ListRevealGrid.tsx",
    "ListRevealGrid.css",
    "FlowDiagram.tsx",
    "FlowDiagram.css",
    "HookImageStrip.tsx",
    "HookImageStrip.css",
    "VisualBlock.tsx",
    "VisualBlock.css",
    "ProgressBar.tsx",
    "ProgressBar.css",
    "AutoStartGate.tsx",
    "AutoStartGate.css",
    "AutoToggle.tsx",
    "AutoToggle.css",
    "StageNav.tsx",
    "StageNav.css",
    "ChapterFigure.tsx",
    "ChapterFigure.css",
  ] as const;
  for (const name of componentFiles) {
    await copyFile(join(t, "src/components", name), join(targetDir, "src/components", name));
  }
  const visualDir = join(t, "src/components/visual");
  const visualNames = [
    "ChartRenderer.tsx",
    "ChartRenderer.css",
    "TableRenderer.tsx",
    "TableRenderer.css",
    "table-utils.ts",
    "AnimationRenderer.tsx",
    "AnimationRenderer.css",
  ];
  await mkdir(join(targetDir, "src/components/visual"), { recursive: true });
  for (const name of visualNames) {
    await copyFile(join(visualDir, name), join(targetDir, "src/components/visual", name));
  }

  await copyFile(join(t, "src/registry/types.ts"), join(targetDir, "src/registry/types.ts"));
  await copyFile(join(t, "src/registry/chapters.ts"), join(targetDir, "src/registry/chapters.ts"));

  for (const ex of ["Example.tsx", "Example.css", "narrations.ts"]) {
    await copyFile(
      join(t, "src/chapters/01-example", ex),
      join(targetDir, "src/chapters/01-example", ex),
    );
  }

  await copyFile(
    join(t, "scripts/extract-narrations.ts"),
    join(targetDir, "scripts/extract-narrations.ts"),
  );
  await copyFile(
    join(t, "scripts/synthesize-audio.sh"),
    join(targetDir, "scripts/synthesize-audio.sh"),
  );

  await writeFile(
    join(targetDir, "package.json"),
    `${JSON.stringify(PRESENTATION_PACKAGE_JSON, null, 2)}\n`,
  );
  await writeFile(
    join(targetDir, "tsconfig.json"),
    `${JSON.stringify(PRESENTATION_TSCONFIG, null, 2)}\n`,
  );
  await writeFile(join(targetDir, ".theme"), `${resolvedTheme}\n`);

  return { presentationDir: targetDir, themeId: resolvedTheme };
}
