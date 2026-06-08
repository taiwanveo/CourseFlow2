import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlayableAnimationHtml } from "@/lib/wvp-animation-html";

const CRAFT_ASSETS_BUCKET = "courseflow-assets";

type CraftRow = {
  wvp_chapter_id: string;
  checklist_result?: unknown;
};

type StepIllustrationRow = {
  stepIndex: number;
  imageSource?: string;
  animationHtml?: string | null;
  /** Phase 3：DSL → Framer Motion（優先於 HTML） */
  animationConfig?: Record<string, unknown> | null;
  animationStoragePath?: string | null;
};

function readStepIllustrations(craft: CraftRow): StepIllustrationRow[] {
  const raw = (craft.checklist_result as { stepIllustrations?: StepIllustrationRow[] } | null)
    ?.stepIllustrations;
  return Array.isArray(raw) ? raw : [];
}

/** Supabase Storage 路徑：與配圖 wvp-illustrations 並列的 wvp-animations */
export function craftAnimationStoragePath(
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
): string {
  const fileName = `${String(stepIndex + 1).padStart(2, "0")}.html`;
  return `${userId}/${projectId}/wvp-animations/${wvpChapterId}/${fileName}`;
}

export async function uploadCraftAnimationToStorage(
  supabase: SupabaseClient,
  storagePath: string,
  html: string,
): Promise<void> {
  const { error } = await supabase.storage.from(CRAFT_ASSETS_BUCKET).upload(
    storagePath,
    Buffer.from(html, "utf-8"),
    { contentType: "text/html; charset=utf-8", upsert: true },
  );
  if (error) throw new Error(error.message);
}

export async function downloadCraftAnimationFromStorage(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(CRAFT_ASSETS_BUCKET).download(storagePath);
  if (error || !data) return null;
  const text = await data.text();
  return text.trim() ? text : null;
}

/** 寫入 presentation/public/animations/<chapterId>/01.html */
export async function writePresentationAnimationFile(
  presentationDir: string,
  wvpChapterId: string,
  stepIndex: number,
  html: string,
): Promise<void> {
  const dir = join(presentationDir, "public", "animations", wvpChapterId);
  await mkdir(dir, { recursive: true });
  const fileName = `${String(stepIndex + 1).padStart(2, "0")}.html`;
  await writeFile(join(dir, fileName), html, "utf-8");
}

/** 取得 presentation 中 animation 的相對 URL（給 chapter TSX 用） */
export function stepAnimationRelPath(wvpChapterId: string, stepIndex: number): string {
  const fileName = `${String(stepIndex + 1).padStart(2, "0")}.html`;
  return `animations/${wvpChapterId}/${fileName}`;
}

export type StepAnimationSyncResult = {
  written: number;
  reused: number;
  attempted: number;
};

export type StepAnimationHtmlMap = {
  indices: number[];
  htmlByStep: Partial<Record<number, string>>;
};

export type StepAnimationBundle = StepAnimationHtmlMap & {
  configByStep: Partial<Record<number, Record<string, unknown>>>;
};

function motionConfigFromUnknown(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (typeof o.pattern !== "string" || !o.params || typeof o.params !== "object") return null;
  return {
    version: typeof o.version === "number" ? o.version : 1,
    pattern: o.pattern,
    params: o.params as Record<string, unknown>,
  };
}

/** 寫入 presentation/public/animations/<chapterId>/<NN>.json（Phase 3 Motion DSL） */
export async function writePresentationAnimationConfigFile(
  presentationDir: string,
  wvpChapterId: string,
  stepIndex: number,
  config: Record<string, unknown>,
): Promise<void> {
  const dir = join(presentationDir, "public", "animations", wvpChapterId);
  await mkdir(dir, { recursive: true });
  const fileName = `${String(stepIndex + 1).padStart(2, "0")}.json`;
  await writeFile(join(dir, fileName), `${JSON.stringify(config)}\n`, "utf-8");
}

/** 掃描 presentation/public/animations 並回傳可內嵌至章節 TSX 的 HTML + Motion config */
export async function loadStepAnimationBundle(
  presentationDir: string,
  wvpChapterId: string,
): Promise<StepAnimationBundle> {
  const dir = join(presentationDir, "public", "animations", wvpChapterId);
  const indexSet = new Set<number>();
  const htmlByStep: Partial<Record<number, string>> = {};
  const configByStep: Partial<Record<number, Record<string, unknown>>> = {};
  try {
    const names = await readdir(dir);
    for (const name of names) {
      const htmlMatch = /^(\d{2})\.html$/i.exec(name);
      const jsonMatch = /^(\d{2})\.json$/i.exec(name);
      const m = htmlMatch ?? jsonMatch;
      if (!m) continue;
      const step = Number.parseInt(m[1]!, 10) - 1;
      if (step < 0) continue;
      try {
        if (htmlMatch) {
          const html = await readFile(join(dir, name), "utf-8");
          if (!isPlayableAnimationHtml(html)) continue;
          indexSet.add(step);
          htmlByStep[step] = html;
        } else if (jsonMatch) {
          const raw = await readFile(join(dir, name), "utf-8");
          const parsed = motionConfigFromUnknown(JSON.parse(raw) as unknown);
          if (!parsed) continue;
          indexSet.add(step);
          configByStep[step] = parsed;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return { indices: [], htmlByStep: {}, configByStep: {} };
  }
  const indices = [...indexSet].sort((a, b) => a - b);
  return { indices, htmlByStep, configByStep };
}

/** @deprecated 請改用 loadStepAnimationBundle */
export async function loadStepAnimationHtmlMap(
  presentationDir: string,
  wvpChapterId: string,
): Promise<StepAnimationHtmlMap> {
  const bundle = await loadStepAnimationBundle(presentationDir, wvpChapterId);
  return { indices: bundle.indices, htmlByStep: bundle.htmlByStep };
}

export type HeuristicExplainAnimationSyncResult = {
  written: number;
  skippedCraft: number;
};

/**
 * 打包前：從 checklist / Storage 還原各步解說動畫 HTML 至 presentation/public/animations/。
 */
export async function syncPresentationStepAnimations(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  presentationDir: string,
  crafts: CraftRow[],
): Promise<StepAnimationSyncResult> {
  let written = 0;
  let reused = 0;
  let attempted = 0;

  for (const craft of crafts) {
    for (const step of readStepIllustrations(craft)) {
      if (step.imageSource !== "animation") continue;
      attempted++;

      const motionCfg = motionConfigFromUnknown(step.animationConfig);
      if (motionCfg) {
        const animDir = join(
          presentationDir,
          "public",
          "animations",
          craft.wvp_chapter_id,
        );
        const fileName = `${String(step.stepIndex + 1).padStart(2, "0")}.json`;
        const target = join(animDir, fileName);
        const payload = `${JSON.stringify(motionCfg)}\n`;
        try {
          await access(target);
          const existing = await readFile(target, "utf-8");
          if (existing.trim() === payload.trim()) {
            reused++;
            continue;
          }
        } catch {
          /* 尚未寫入 */
        }
        await writePresentationAnimationConfigFile(
          presentationDir,
          craft.wvp_chapter_id,
          step.stepIndex,
          motionCfg,
        );
        written++;
        continue;
      }

      let html = step.animationHtml?.trim() ?? "";
      if (!html && step.animationStoragePath?.trim()) {
        html =
          (await downloadCraftAnimationFromStorage(supabase, step.animationStoragePath.trim())) ??
          "";
      }
      if (!html || !isPlayableAnimationHtml(html)) continue;

      const animDir = join(
        presentationDir,
        "public",
        "animations",
        craft.wvp_chapter_id,
      );
      const fileName = `${String(step.stepIndex + 1).padStart(2, "0")}.html`;
      const target = join(animDir, fileName);
      try {
        await access(target);
        const existing = await readFile(target, "utf-8");
        if (existing.trim() === html.trim()) {
          reused++;
          continue;
        }
      } catch {
        /* 尚未寫入 */
      }

      await writePresentationAnimationFile(
        presentationDir,
        craft.wvp_chapter_id,
        step.stepIndex,
        html,
      );
      written++;
    }
  }

  return { written, reused, attempted };
}

/**
 * 打包前：對無手動解說動畫的步驟，以 explain-animation DSL 啟發式產 HTML。
 * 讓 Visual-Mix 隱喻步（交集、前後對照、等式等）不必逐格點「AI 畫面」也能預覽。
 */
export async function syncHeuristicExplainAnimations(
  presentationDir: string,
  opts: {
    wvpChapterId: string;
    narrations: string[];
    screenContents: string[];
    themeId: string;
    craft?: CraftRow;
  },
): Promise<HeuristicExplainAnimationSyncResult> {
  const { inferExplainAnimation, isMotionRenderable, renderExplainAnimationHtml } = await import(
    "@courseflow/explain-animation"
  );
  const craftAnimated = new Set(
    readStepIllustrations(opts.craft ?? { wvp_chapter_id: opts.wvpChapterId })
      .filter((s) => {
        if (s.imageSource !== "animation") return false;
        if (motionConfigFromUnknown(s.animationConfig)) return true;
        const inline = s.animationHtml?.trim() ?? "";
        return Boolean(inline && isPlayableAnimationHtml(inline));
      })
      .map((s) => s.stepIndex),
  );

  let written = 0;
  let skippedCraft = 0;
  const n = Math.max(opts.narrations.length, opts.screenContents.length);
  for (let step = 0; step < n; step++) {
    if (craftAnimated.has(step)) {
      skippedCraft++;
      continue;
    }
    const script = opts.narrations[step]?.trim() ?? "";
    const screen = opts.screenContents[step]?.trim() ?? "";
    if (!script && !screen) continue;
    const inferred = inferExplainAnimation(script, screen);
    if (!inferred) continue;

    if (isMotionRenderable(inferred.config)) {
      const motionRecord = {
        version: inferred.config.version ?? 1,
        pattern: inferred.config.pattern,
        params: inferred.config.params,
      };
      await writePresentationAnimationConfigFile(
        presentationDir,
        opts.wvpChapterId,
        step,
        motionRecord,
      );
      const htmlPath = join(
        presentationDir,
        "public",
        "animations",
        opts.wvpChapterId,
        `${String(step + 1).padStart(2, "0")}.html`,
      );
      try {
        await unlink(htmlPath);
      } catch {
        /* 無舊 HTML 可刪 */
      }
      written++;
      continue;
    }

    const html = renderExplainAnimationHtml(inferred.config, { themeId: opts.themeId });
    if (!isPlayableAnimationHtml(html)) continue;
    await writePresentationAnimationFile(presentationDir, opts.wvpChapterId, step, html);
    written++;
  }
  return { written, skippedCraft };
}
