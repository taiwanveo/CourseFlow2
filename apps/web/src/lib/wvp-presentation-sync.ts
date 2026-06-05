import type { SupabaseClient } from "@supabase/supabase-js";
import type { WvpChapterKind } from "@courseflow/core";
import {
  buildPresentation,
  chapterComponentName,
  scaffoldPresentation,
  validateChapterTsx,
  writeChapterSourcesRaw,
  writeChapterToPresentation,
  writeChaptersRegistry,
  type RegistryChapterEntry,
  type StepVisualEntry,
} from "@courseflow/presentation";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { syncPresentationAudioFromComposition } from "@/lib/wvp-audio-sync";
import { syncPresentationIllustrations } from "@/lib/wvp-illustration-sync";
import { craftPackIllustrationOpts, syncChapterIllustrationToStepImages } from "@/lib/wvp-craft-illustrations";
import { syncCheckpointAssetsToPresentation } from "@/lib/wvp-checkpoint-assets-sync";
import { uploadWvpDistToStorage } from "@/lib/wvp-dist-storage";
import { shouldAsyncWvpBuild } from "@/lib/wvp-build-async";
import { narrationsForChapter, orderedWvpStepsForChapter } from "@/lib/wvp-chapters";
import { makeDefaultStepMotions, pickEnterAnimation } from "@/lib/wvp-motion-utils";
import {
  chapterKindForCraft,
  resolveCompositionChapterForCraft,
  screenContentsForChapter,
  toScreenHeadline,
} from "@/lib/wvp-chapter-meta";
import { loadCompositionForWvpBuild } from "@/lib/project-composition";
import { chapterAssetsForCodegen } from "@/lib/wvp-assets";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { parseWvpSettings, type WvpAssetRef } from "@/lib/wvp-settings";
import {
  resolveStepImageExtMapFromLocalDir,
  resolveStepImageExtMapLocal,
} from "@/lib/wvp-step-image-resolve";
import { readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import type { CourseComposition } from "@courseflow/core";

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  sort_order: number;
  presentation_path?: string | null;
    checklist_result?: {
    narrations?: string[];
    stepVisualConfigs?: StepVisualEntry[];
    aiPlan?: {
      chapterKind?: string;
      visualIdeas?: string[];
      stepBeats?: { step: number; dominantAction?: string }[];
      stepVisuals?: { step: number; vizType?: string; concept?: string }[];
    };
    chapterSource?: {
      chapterTsx?: string;
      chapterCss?: string;
      source?: "llm" | "template";
    };
  } | null;
};

function folderFromPresentationPath(path: string | null, sortOrder: number, wvpChapterId: string) {
  if (path) {
    const seg = path.split("/").pop();
    if (seg) return seg;
  }
  return `${sortOrder.toString().padStart(2, "0")}-${wvpChapterId}`;
}

function normalizeForSimilarity(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

function bigramSet(text: string): Set<string> {
  const norm = normalizeForSimilarity(text);
  if (!norm) return new Set();
  if (norm.length === 1) return new Set([norm]);
  const out = new Set<string>();
  for (let i = 0; i < norm.length - 1; i += 1) out.add(norm.slice(i, i + 2));
  return out;
}

function jaccardSimilarity(a: string, b: string): number {
  const aa = bigramSet(a);
  const bb = bigramSet(b);
  if (aa.size === 0 || bb.size === 0) return 0;
  let intersection = 0;
  for (const token of aa) {
    if (bb.has(token)) intersection += 1;
  }
  const union = aa.size + bb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function logWvpBuildQuality(composition: CourseComposition, resolvedThemeId: string): void {
  const steps = composition.steps.filter((s) => s.stepKind !== "chapter");
  if (steps.length === 0) {
    console.log(`[wvp-quality] theme=${resolvedThemeId} steps=0`);
    return;
  }

  const shortHeadlineCount = steps.filter(
    (s) => toScreenHeadline(s.screenContent ?? "", "").length <= 16,
  ).length;
  const longHeadlineCount = steps.filter(
    (s) => toScreenHeadline(s.screenContent ?? "", "").length > 16,
  ).length;
  const highSimilarityCount = steps.filter(
    (s) => jaccardSimilarity(s.screenContent ?? "", s.script ?? "") >= 0.6,
  ).length;

  console.log(
    `[wvp-quality] theme=${resolvedThemeId} steps=${steps.length} shortHeadline=${shortHeadlineCount} longHeadline=${longHeadlineCount} highSimilarity=${highSimilarityCount}`,
  );
}

export async function ensurePresentationScaffolded(
  projectId: string,
  themeId: string,
): Promise<string> {
  const dir = presentationDirForProject(projectId);
  await scaffoldPresentation(dir, themeId);
  return dir;
}

export async function materializeChapterFromCraft(
  presentationDir: string,
  craft: CraftRow,
  composition: CourseComposition,
  projectAssets?: WvpAssetRef[],
): Promise<RegistryChapterEntry> {
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  const narrationsFromComposition = chapter
    ? narrationsForChapter(composition, chapter.id)
    : [];
  const narrationsFromChecklist = Array.isArray(craft.checklist_result?.narrations)
    ? craft.checklist_result.narrations
    : [];
  let narrations = narrationsFromComposition;
  if (!chapter && narrationsFromChecklist.length > 0) {
    narrations = narrationsFromChecklist;
  } else if (
    chapter &&
    narrationsFromChecklist.length > narrationsFromComposition.length
  ) {
    console.warn(
      `[wvp-materialize] narration count mismatch chapter=${craft.wvp_chapter_id} composition=${narrationsFromComposition.length} checklist=${narrationsFromChecklist.length}; using checklist`,
    );
    narrations = narrationsFromChecklist;
  }
  const aiPlan = craft.checklist_result?.aiPlan;
  const rawSource = craft.checklist_result?.chapterSource;
  const folderName = folderFromPresentationPath(
    craft.presentation_path ?? null,
    craft.sort_order,
    craft.wvp_chapter_id,
  );
  const componentName = `Chapter${chapterComponentName(craft.wvp_chapter_id)}`;

  const assets = chapterAssetsForCodegen(projectAssets, craft.wvp_chapter_id);
  const checklist = craft.checklist_result as
    | {
        appliedTemplate?: string;
        chapterSource?: { templateKind?: string };
      }
    | undefined;
  const forceTemplate = resolveCraftForceTemplate(checklist);
  const llmTsx = rawSource?.chapterTsx?.trim() ?? "";
  // 比對目前 screenContents 與 LLM TSX 快取：若使用者在「文稿內容」階段修改了
  // 螢幕內容，快取的 TSX 會有過期的硬編碼文字，需重新從模板產生。
  const currentScreenContents = chapter ? screenContentsForChapter(composition, chapter.id) : [];
  const llmCacheScreenContentsStale =
    llmTsx &&
    currentScreenContents
      .filter((sc) => sc && sc !== "重點" && sc.length > 3)
      .some((sc) => !llmTsx.includes(sc));
  const useCachedLlmSource =
    rawSource?.source === "llm" &&
    !forceTemplate &&
    assets.length === 0 &&
    llmTsx &&
    !llmCacheScreenContentsStale &&
    validateChapterTsx(
      llmTsx,
      narrations.length,
      componentName,
      rawSource?.chapterCss ?? "",
      narrations,
    );
  if (useCachedLlmSource) {
    await writeChapterSourcesRaw(presentationDir, {
      folderName,
      componentName,
      narrations,
      chapterTsx: llmTsx,
      chapterCss: rawSource?.chapterCss?.trim() || "/* CourseFlow LLM chapter */\n",
    });
  } else {
    const stepVisualConfigs = craft.checklist_result?.stepVisualConfigs;
    const resolvedChapterKind = chapter
      ? chapterKindForCraft(composition, chapter.id, craft.title, narrations, aiPlan)
      : undefined;
    const stepMotions = chapter
      ? (() => {
          const steps = orderedWvpStepsForChapter(composition, chapter.id);
          const hasCustomVisualMotions = steps.some((s) => {
            const visual = composition.visuals.find((v) => v.stepId === s.id);
            return Boolean(visual?.enterAnimationId && visual.enterAnimationId !== "fade-up");
          });
          if (!hasCustomVisualMotions && resolvedChapterKind) {
            return makeDefaultStepMotions(narrations.length, {
              narrations,
              screenContents: currentScreenContents,
              chapterKind: resolvedChapterKind,
            });
          }
          return steps.map((s, stepIndex) => {
            const visual = composition.visuals.find((v) => v.stepId === s.id);
            return {
              enterAnimationId: visual?.enterAnimationId ?? pickEnterAnimation(stepIndex),
              transitionId: visual?.transitionId ?? "crossfade",
            };
          });
        })()
      : [];
    const projectIdFromPath = basename(dirname(presentationDir));
    // 直接從 presentationDir 掃描，避免 presentationDirForProject 路徑重建不一致
    const stepImageExtensionsFromDir: Record<number, string> = {};
    try {
      const imgDir = join(presentationDir, "public", "images", craft.wvp_chapter_id);
      const names = await readdir(imgDir);
      for (const name of names) {
        const m = /^(\d{2})\.([a-z0-9]+)$/i.exec(name);
        if (!m) continue;
        const step = Number.parseInt(m[1]!, 10) - 1;
        if (step >= 0) stepImageExtensionsFromDir[step] = m[2]!.toLowerCase();
      }
    } catch { /* 目錄不存在 */ }
    const stepImageExtensions = {
      ...(await resolveStepImageExtMapLocal(projectIdFromPath, craft)),
      ...stepImageExtensionsFromDir,
    };

    // 掃描動畫目錄，找出哪些 step 有動畫 HTML 檔
    const stepAnimationIndices: number[] = [];
    try {
      const animDir = join(presentationDir, "public", "animations", craft.wvp_chapter_id);
      const animFiles = await readdir(animDir);
      for (const name of animFiles) {
        const m = /^(\d{2})\.html$/i.exec(name);
        if (!m) continue;
        const step = Number.parseInt(m[1]!, 10) - 1;
        if (step >= 0) stepAnimationIndices.push(step);
      }
    } catch { /* 目錄不存在 */ }

    const preferImageTemplate =
      hasPackagedStepImagesForCraft(craft) ||
      Object.keys(stepImageExtensions).length > 0;
    const written = await writeChapterToPresentation(presentationDir, {
      folderName,
      wvpChapterId: craft.wvp_chapter_id,
      title: craft.title,
      narrations,
      visualIdeas: aiPlan?.visualIdeas,
      stepBeats: aiPlan?.stepBeats,
      stepVisuals: (aiPlan?.stepVisuals as { step: number; vizType?: string }[]) ?? undefined,
      screenContents: chapter ? currentScreenContents : [],
      chapterKind: resolvedChapterKind,
      forceTemplate,
      assets: assets.length ? assets : undefined,
      stepVisualConfigs: preferImageTemplate ? undefined : stepVisualConfigs,
      stepMotions,
      stepImageExtensions,
      stepAnimationIndices: stepAnimationIndices.length ? stepAnimationIndices : undefined,
    });
    if (
      written.narrations.length > 0 &&
      written.narrations.length !== narrations.length &&
      craft.checklist_result
    ) {
      craft.checklist_result = {
        ...craft.checklist_result,
        narrations: written.narrations,
      };
    }
  }

  return {
    folderName,
    wvpChapterId: craft.wvp_chapter_id,
    title: craft.title,
    componentName,
    componentFileName: `${componentName}.tsx`,
  };
}

export async function rebuildRegistryForProject(
  presentationDir: string,
  crafts: CraftRow[],
  composition: CourseComposition,
  projectAssets?: WvpAssetRef[],
): Promise<RegistryChapterEntry[]> {
  const entries: RegistryChapterEntry[] = [];
  const sorted = [...crafts].sort((a, b) => a.sort_order - b.sort_order);

  for (const craft of sorted) {
    const hasNarrations =
      (craft.checklist_result?.narrations?.length ?? 0) > 0 ||
      !!resolveCompositionChapterForCraft(composition, craft);
    if (!hasNarrations) continue;
    entries.push(
      await materializeChapterFromCraft(
        presentationDir,
        craft,
        composition,
        projectAssets,
      ),
    );
  }

  await writeChaptersRegistry(presentationDir, entries, { removeExample: entries.length > 0 });
  return entries;
}

export async function buildProjectPresentation(
  projectId: string,
  previewBase: string,
): Promise<{ distDir: string; chaptersVisualUpgraded?: string[] }> {
  const dir = presentationDirForProject(projectId);
  return buildPresentation(dir, { previewBase });
}

/** 打包配圖：預設 auto（沿用既有圖，缺圖時做內容感知決策）；=reuse 僅沿用；=1 重算；=0 略過 */
function packIllustrationMode(): "skip" | "reuse" | "auto" | "regenerate" {
  const v = process.env.COURSEFLOW_PACK_ILLUSTRATIONS?.trim();
  if (v === "0") return "skip";
  if (v === "reuse") return "reuse";
  if (v === "auto" || !v) return "auto";
  if (v === "1") return "regenerate";
  return "auto";
}

function requiresDistInStorage(): boolean {
  return (
    !!process.env.COURSEFLOW_PRESENTATION_ROOT?.trim() ||
    process.env.RENDER === "true" ||
    shouldAsyncWvpBuild()
  );
}

const WVP_TEMPLATE_KINDS = new Set<string>([
  "list-reveal",
  "flow",
  "hook",
  "magazine",
]);

function resolveCraftForceTemplate(
  checklist:
    | { appliedTemplate?: string; chapterSource?: { templateKind?: string } }
    | undefined,
): WvpChapterKind | undefined {
  const applied = checklist?.appliedTemplate?.trim();
  if (applied && WVP_TEMPLATE_KINDS.has(applied as WvpChapterKind)) {
    return applied as WvpChapterKind;
  }
  const kind = checklist?.chapterSource?.templateKind?.trim();
  if (kind && kind !== "visual-mix" && WVP_TEMPLATE_KINDS.has(kind as WvpChapterKind)) {
    return kind as WvpChapterKind;
  }
  return undefined;
}

function hasPackagedStepImagesForCraft(craft: CraftRow): boolean {
  const raw = (craft.checklist_result as { stepIllustrations?: unknown } | undefined)
    ?.stepIllustrations;
  if (!Array.isArray(raw)) return false;
  return raw.some(
    (s) =>
      s &&
      typeof s === "object" &&
      ((s as { imageWritten?: boolean; status?: string }).imageWritten === true ||
        (s as { status?: string }).status === "done"),
  );
}

const STEP_IMAGE_FILE_RE = /^\d{2}\.(jpe?g|png|gif|bmp)$/i;

async function chapterIllustrationFilesOnDisk(
  projectId: string,
  wvpChapterId: string,
): Promise<boolean> {
  const dir = join(
    presentationDirForProject(projectId),
    "public",
    "images",
    wvpChapterId,
  );
  try {
    const names = await readdir(dir);
    return names.some((n) => STEP_IMAGE_FILE_RE.test(n));
  } catch {
    return false;
  }
}

function stepIllustrationsMarkedDone(craft: CraftRow): boolean {
  const raw = (craft.checklist_result as { stepIllustrations?: unknown } | undefined)
    ?.stepIllustrations;
  if (!Array.isArray(raw)) return false;
  return raw.some(
    (s) =>
      s &&
      typeof s === "object" &&
      (s as { imageWritten?: boolean; status?: string }).imageWritten === true,
  );
}

/** 第 1 章試跑預覽：僅註冊第 1 章、略過語音門檻、打包 dist */
export async function buildAnchorChapterPreview(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts?: { themeId?: string; onStage?: (stage: string) => Promise<void> | void },
): Promise<{
  built: boolean;
  wvpChapterId: string;
  illustrationSyncWarning?: string;
}> {
  const { data: project } = await supabase
    .from("projects")
    .select("theme_id, wvp_settings, title")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  if (!project) throw new Error("找不到專案");

  const wvpSettings = parseWvpSettings(project.wvp_settings);

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const first = (crafts ?? [])[0] as CraftRow | undefined;
  if (!first) throw new Error("請先建立章節清單");

  const composition = await loadCompositionForWvpBuild(supabase, projectId);
  if (!composition) throw new Error("無法載入專案內容");
  const themeId =
    opts?.themeId ??
    composition.meta.themeId ??
    wvpSettings.themeId ??
    project.theme_id ??
    "midnight-press";

  const presentationDir = await ensurePresentationScaffolded(projectId, themeId);

  await syncCheckpointAssetsToPresentation(projectId, wvpSettings.assets);

  let illustrationSyncWarning: string | undefined;
  if (packIllustrationMode() !== "skip") {
    const styleFragment = await resolveImageStyleFragment(wvpSettings.imageStyle, themeId);
    const illus = await syncPresentationIllustrations(
      supabase,
      userId,
      projectId,
      project.title ?? "Course",
      composition,
      [first] as Parameters<typeof syncPresentationIllustrations>[5],
      wvpSettings.assets,
      styleFragment,
      themeId,
      craftPackIllustrationOpts,
    );
    const hasLocalImages = await chapterIllustrationFilesOnDisk(
      projectId,
      first.wvp_chapter_id,
    );
    const studioMarkedDone = stepIllustrationsMarkedDone(first);
    if (illus.written + illus.reusedExisting === 0 && !hasLocalImages) {
      illustrationSyncWarning = studioMarkedDone
        ? "配圖無法寫入預覽目錄，請在「視覺動效」重新上傳或生圖後再試執行。"
        : "試跑未找到已完成的配圖；請先在「視覺動效」生圖或上傳。";
    }
  }

  const entries = await rebuildRegistryForProject(
    presentationDir,
    [first],
    composition,
    wvpSettings.assets,
  );
  if (entries.length === 0) {
    throw new Error("第 1 章尚無口播步驟，請先在「文稿內容」完成大綱");
  }

  const base = `/projects/${projectId}/wvp-embed/`;
  await opts?.onStage?.("vite-build-start");
  try {
    await buildProjectPresentation(projectId, base);
  } finally {
    await opts?.onStage?.("vite-build-done");
  }
  logWvpBuildQuality(composition, themeId);

  const presentationRevision = `anchor-trial-${Date.now()}`;
  const nextSettings = {
    ...wvpSettings,
    themeId,
    anchorChapterTrialCompleted: true,
  };
  await supabase
    .from("projects")
    .update({
      wvp_settings: nextSettings,
      presentation_revision: presentationRevision,
    })
    .eq("id", projectId);

  if (requiresDistInStorage()) {
    await opts?.onStage?.("dist-upload-start");
    try {
      await uploadWvpDistToStorage(supabase, userId, projectId);
    } catch (e) {
      const msg = (e as Error).message;
      console.warn("[wvp-trial] dist 上傳 Storage 失敗:", msg);
      throw new Error(
        `試執行建置完成但無法上傳預覽（${msg}）。請稍後重試或檢查 Storage 設定。`,
      );
    } finally {
      await opts?.onStage?.("dist-upload-done");
    }
  }

  return {
    built: true,
    wvpChapterId: first.wvp_chapter_id,
    illustrationSyncWarning,
  };
}

export async function syncFullWvpProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts?: { themeId?: string; build?: boolean; previewBase?: string },
): Promise<{
  presentationDir: string;
  chapterCount: number;
  built: boolean;
  distDir?: string;
  chaptersVisualUpgraded?: string[];
  storageUploaded?: boolean;
  storageUploadWarning?: string;
  audioSyncWarning?: string;
  illustrationSyncWarning?: string;
}> {
  const { data: project } = await supabase
    .from("projects")
    .select("theme_id, wvp_settings, title")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  if (!project) throw new Error("找不到專案");

  const wvpSettings = parseWvpSettings(project.wvp_settings);

  const composition = await loadCompositionForWvpBuild(supabase, projectId);
  if (!composition) throw new Error("無法載入專案內容");
  const themeId =
    opts?.themeId ??
    composition.meta.themeId ??
    wvpSettings.themeId ??
    project.theme_id ??
    "midnight-press";
  const presentationDir = await ensurePresentationScaffolded(projectId, themeId);

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  const entries = await rebuildRegistryForProject(
    presentationDir,
    (crafts ?? []) as CraftRow[],
    composition,
    wvpSettings.assets,
  );

  let built = false;
  let distDir: string | undefined;
  let chaptersVisualUpgraded: string[] | undefined;
  let storageUploaded = false;
  let storageUploadWarning: string | undefined;
  let audioSyncWarning: string | undefined;
  let illustrationSyncWarning: string | undefined;
  if (opts?.build && entries.length > 0) {
    const audioGate = evaluateWvpAudioBuildGate(composition);
    if (!audioGate.ready) {
      throw new Error(audioGate.message ?? "請先完成語音合成");
    }

    await syncCheckpointAssetsToPresentation(projectId, wvpSettings.assets);

    const audioSync = await syncPresentationAudioFromComposition(
      supabase,
      projectId,
      composition,
      (crafts ?? []) as CraftRow[],
    );
    if (audioSync.compositionAudioCount === 0) {
      audioSyncWarning =
        "專案尚無語音資產：請先在「3. 語音生成」完成 TTS 合成，再到「4. 預覽匯出」建置預覽。";
    } else if (audioSync.written === 0) {
      audioSyncWarning =
        "無法寫入任何 mp3（Storage 下載失敗或章節標題與 Craft 不一致）。請確認語音已合成並重新建置。";
    } else if (audioSync.written < audioSync.expectedSteps) {
      audioSyncWarning = `僅寫入 ${audioSync.written}/${audioSync.expectedSteps} 段語音；部分步驟將無聲或依字數估算自動換頁。`;
    }

    // 先把「章節配圖」（整章一張圖）複製成各步驟本機圖片，
    // 讓後續 syncPresentationIllustrations 的 reuseExistingFiles 路徑能掃到
    for (const craft of (crafts ?? []) as CraftRow[]) {
      const cr = craft.checklist_result as { chapterIllustration?: { visualMode?: string } } | null;
      if (cr?.chapterIllustration?.visualMode && cr.chapterIllustration.visualMode !== "animation") {
        const chapter2 = resolveCompositionChapterForCraft(composition, craft);
        const narrationCount = chapter2 ? narrationsForChapter(composition, chapter2.id).length : 0;
        if (narrationCount > 0) {
          await syncChapterIllustrationToStepImages(
            supabase,
            userId,
            projectId,
            craft,
            narrationCount,
          ).catch((e) =>
            console.warn(`[wvp-build] chapter illustration sync failed for ${craft.wvp_chapter_id}:`, e),
          );
        }
      }
    }

    const illusMode = packIllustrationMode();
    if (illusMode !== "skip") {
      const styleFragment = await resolveImageStyleFragment(wvpSettings.imageStyle, themeId);
      const syncOpts =
        illusMode === "regenerate"
          ? { skipVisualDirector: false, reuseExistingFiles: false }
          : craftPackIllustrationOpts;
      const illus = await syncPresentationIllustrations(
        supabase,
        userId,
        projectId,
        project.title ?? "Course",
        composition,
        (crafts ?? []) as Parameters<typeof syncPresentationIllustrations>[5],
        wvpSettings.assets,
        styleFragment,
        themeId,
        syncOpts,
      );
      if (illusMode === "reuse") {
        const packed = illus.written + illus.reusedExisting;
        if (packed === 0) {
          illustrationSyncWarning =
            "未找到配圖工作室已完成的圖片；請先在「視覺動效」完成 AI 生圖或上傳後再打包。";
        }
      } else if (illusMode === "auto") {
        const packed = illus.written + illus.reusedExisting;
        if (packed === 0 && illus.directorSkipped === 0 && illus.attempted === 0) {
          illustrationSyncWarning =
            "本次建置未產生任何步驟配圖；該章可能改走內容感知動畫/圖表，或尚未具備可生成圖片的步驟。";
        }
      } else if (illus.skippedNoKey && illus.attempted > 0) {
        illustrationSyncWarning =
          "清單章節需 AI 配圖：請在設定頁填寫 OpenAI 或 OpenRouter API Key 後重新建置。";
      } else if (illus.attempted > 0 && illus.written === 0) {
        illustrationSyncWarning = "AI 配圖未成功寫入（可檢查 API 額度或稍後重試建置）。";
      } else if (illus.written > 0 && illus.written < illus.attempted) {
        illustrationSyncWarning = `已生成 ${illus.written}/${illus.attempted} 張配圖，其餘卡片僅顯示標題。`;
      }

      await rebuildRegistryForProject(
        presentationDir,
        (crafts ?? []) as CraftRow[],
        composition,
        wvpSettings.assets,
      );
    }

    const base = opts.previewBase ?? `/projects/${projectId}/wvp-embed/`;
    const result = await buildProjectPresentation(projectId, base);
    logWvpBuildQuality(composition, themeId);
    distDir = result.distDir;
    built = true;
    chaptersVisualUpgraded = result.chaptersVisualUpgraded;
    try {
      await uploadWvpDistToStorage(supabase, userId, projectId);
      storageUploaded = true;
    } catch (e) {
      const msg = (e as Error).message;
      storageUploadWarning = msg;
      console.warn("[wvp] dist 上傳 Storage 失敗:", msg);
    }
    if (requiresDistInStorage() && !storageUploaded) {
      throw new Error(
        storageUploadWarning ??
          "雲端預覽需將建置結果上傳至 Storage，上傳失敗請稍後重試或檢查 Storage 設定。",
      );
    }
    await supabase
      .from("projects")
      .update({ presentation_revision: `built-${Date.now()}` })
      .eq("id", projectId);
  }

  return {
    presentationDir,
    chapterCount: entries.length,
    built,
    distDir,
    chaptersVisualUpgraded,
    storageUploaded,
    storageUploadWarning,
    audioSyncWarning,
    illustrationSyncWarning,
  };
}
