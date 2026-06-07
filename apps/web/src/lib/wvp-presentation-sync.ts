import type { SupabaseClient } from "@supabase/supabase-js";
import type { WvpChapterKind } from "@courseflow/core";
import {
  buildPresentation,
  chapterComponentName,
  isDataVisualChapter,
  scaffoldPresentation,
  chapterUsesPlaceholderScreenText,
  craftMetadataLeakedInTsx,
  tsxLeaksNarrationOntoScreen,
  validateChapterTsx,
  writeChapterSourcesRaw,
  writeChapterToPresentation,
  writeChaptersRegistry,
  type RegistryChapterEntry,
  type StepVisualEntry,
} from "@courseflow/presentation";
import { buildHeuristicStepVisualConfigs } from "@/lib/wvp-step-visual-config";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { syncPresentationAudioFromComposition } from "@/lib/wvp-audio-sync";
import { syncPresentationIllustrations } from "@/lib/wvp-illustration-sync";
import {
  chapterHasStepExplainAnimations,
  craftPackIllustrationOpts,
  syncChapterIllustrationToStepImages,
} from "@/lib/wvp-craft-illustrations";
import {
  loadStepAnimationHtmlMap,
  syncHeuristicExplainAnimations,
  syncPresentationStepAnimations,
} from "@/lib/wvp-animation-sync";
import { syncCheckpointAssetsToPresentation } from "@/lib/wvp-checkpoint-assets-sync";
import { invalidateWvpDistCaches, uploadWvpDistToStorage } from "@/lib/wvp-dist-storage";
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
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import type { WvpBuildPhase } from "@/lib/wvp-build-progress";
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
  opts?: { preserveApprovedAnchorChapter?: boolean; forceFreshChapterSource?: boolean },
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
    narrationsFromComposition.length === 0 &&
    narrationsFromChecklist.length > 0
  ) {
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
        appliedScreenContents?: string[];
        chapterSource?: { templateKind?: string; source?: string };
      }
    | undefined;
  const currentScreenContents = chapter ? screenContentsForChapter(composition, chapter.id) : [];
  const resolvedChapterKind = chapter
    ? chapterKindForCraft(composition, chapter.id, craft.title, narrations, aiPlan)
    : undefined;
  const forceTemplate = resolveCraftForceTemplate(checklist, chapter?.chapterKind);
  const llmTsx = rawSource?.chapterTsx?.trim() ?? "";
  const appliedScreenContents = Array.isArray(checklist?.appliedScreenContents)
    ? checklist.appliedScreenContents.map((s) => (typeof s === "string" ? s.trim() : ""))
    : undefined;
  const screenContentsFingerprint = (screens: string[]) =>
    screens.map((s) => s.trim()).join("\u001e");
  const templateScreenContentsStale =
    appliedScreenContents !== undefined &&
    screenContentsFingerprint(appliedScreenContents) !==
      screenContentsFingerprint(currentScreenContents);
  const appliedTemplateKind =
    checklist?.appliedTemplate?.trim() ||
    checklist?.chapterSource?.templateKind?.trim() ||
    "";
  const cachedTemplateKind =
    detectTsxTemplateKind(llmTsx) ||
    checklist?.chapterSource?.templateKind?.trim() ||
    "";
  const dataVisualChapter = isDataVisualChapter({
    chapterTitle: craft.title,
    narrations,
    screenContents: currentScreenContents,
  });
  const dataVisualNeedsVisualBlock =
    dataVisualChapter && llmTsx.length > 0 && !/VisualBlock/.test(llmTsx);
  /** 數據章每次打包重產 TSX，避免沿用 checklist 內錯誤的 LLM stepVisualConfigs */
  const dataVisualForceRegenerate =
    dataVisualChapter && !hasPackagedStepImagesForCraft(craft);
  const tsxKindMismatch = Boolean(
    resolvedChapterKind &&
      cachedTemplateKind &&
      resolvedChapterKind !== cachedTemplateKind,
  );
  const templateKindMismatch = Boolean(
    appliedTemplateKind &&
      cachedTemplateKind &&
      appliedTemplateKind !== cachedTemplateKind,
  );
  const craftMetadataInCachedTsx = Boolean(llmTsx && craftMetadataLeakedInTsx(llmTsx));
  const placeholderScreenTextInCachedTsx = Boolean(
    llmTsx && chapterUsesPlaceholderScreenText(llmTsx),
  );
  const templateKindStale = Boolean(
    tsxKindMismatch ||
    templateKindMismatch ||
    craftMetadataInCachedTsx ||
    placeholderScreenTextInCachedTsx ||
    dataVisualNeedsVisualBlock ||
    (dataVisualChapter &&
      (cachedTemplateKind === "flow" || cachedTemplateKind === "list-reveal")) ||
    (resolvedChapterKind === "flow" && /VisualBlock/.test(llmTsx)) ||
    (resolvedChapterKind === "list-reveal" && /VisualBlock/.test(llmTsx)),
  );
  const templateNarrationLeakedOnScreen =
    rawSource?.source === "template" &&
    narrations.length > 0 &&
    tsxLeaksNarrationOntoScreen(llmTsx, narrations);
  // LLM TSX：以全文比對；模板 TSX：intro 可能被分段，不可用 includes 判斷過期
  const llmCacheScreenContentsStale =
    rawSource?.source === "template"
      ? templateScreenContentsStale
      : Boolean(
          llmTsx &&
            currentScreenContents
              .filter((sc) => sc.length > 3)
              .some((sc) => !llmTsx.includes(sc)),
        );
  const hasImagesOnDisk = await chapterIllustrationFilesInPresentation(
    presentationDir,
    craft.wvp_chapter_id,
  );
  const animationStepsOnDisk = await chapterAnimationStepsInPresentation(
    presentationDir,
    craft.wvp_chapter_id,
  );
  const cachedPackagedAssetsStale = cachedChapterSourceMissingPackagedAssets(
    llmTsx,
    hasImagesOnDisk,
    animationStepsOnDisk,
  );
  const mustRegenerateForPackagedAssets =
    hasPackagedStepImagesForCraft(craft) ||
    chapterHasStepExplainAnimations(craft) ||
    hasImagesOnDisk ||
    animationStepsOnDisk.length > 0 ||
    cachedPackagedAssetsStale;
  const useCachedLlmSource =
    !mustRegenerateForPackagedAssets &&
    !dataVisualForceRegenerate &&
    rawSource?.source === "llm" &&
    !forceTemplate &&
    !dataVisualNeedsVisualBlock &&
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
  // 模板 TSX 由 applyChapterTemplate 依螢幕欄位產生；驗證失敗時仍優先沿用，避免重產時退回口播稿
  const useCachedTemplateSource =
    !mustRegenerateForPackagedAssets &&
    !dataVisualForceRegenerate &&
    rawSource?.source === "template" &&
    llmTsx &&
    !llmCacheScreenContentsStale &&
    !templateKindStale &&
    !templateNarrationLeakedOnScreen;
  const preserveApprovedAnchor =
    !opts?.forceFreshChapterSource &&
    opts?.preserveApprovedAnchorChapter === true &&
    craft.sort_order === 0 &&
    Boolean(llmTsx);
  if (
    !opts?.forceFreshChapterSource &&
    (preserveApprovedAnchor || useCachedLlmSource || useCachedTemplateSource)
  ) {
    await writeChapterSourcesRaw(presentationDir, {
      folderName,
      componentName,
      narrations,
      chapterTsx: llmTsx,
      chapterCss: rawSource?.chapterCss?.trim() || "/* CourseFlow LLM chapter */\n",
    });
  } else {
    let stepVisualConfigs = craft.checklist_result?.stepVisualConfigs;
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

    const { indices: stepAnimationIndices, htmlByStep: stepAnimationHtmlByStep } =
      await loadStepAnimationHtmlMap(presentationDir, craft.wvp_chapter_id);

    const preferImageTemplate =
      !dataVisualChapter &&
      (hasPackagedStepImagesForCraft(craft) ||
        Object.keys(stepImageExtensions).length > 0);
    if (!preferImageTemplate && dataVisualChapter) {
      const heuristic = buildHeuristicStepVisualConfigs(
        narrations,
        chapter ? currentScreenContents : [],
      );
      if (heuristic.length > 0) {
        stepVisualConfigs = heuristic;
      }
    }
    const effectiveForceTemplate =
      dataVisualChapter &&
      (forceTemplate === "flow" || forceTemplate === "list-reveal")
        ? undefined
        : forceTemplate;
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
      forceTemplate: effectiveForceTemplate,
      assets: assets.length ? assets : undefined,
      stepVisualConfigs: preferImageTemplate ? undefined : stepVisualConfigs,
      stepMotions,
      stepImageExtensions,
      stepAnimationIndices: stepAnimationIndices.length ? stepAnimationIndices : undefined,
      stepAnimationHtmlByStep:
        Object.keys(stepAnimationHtmlByStep).length > 0 ? stepAnimationHtmlByStep : undefined,
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
  opts?: { preserveApprovedAnchorChapter?: boolean; forceFreshChapterSource?: boolean },
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
        opts,
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

function detectTsxTemplateKind(tsx: string): string | undefined {
  if (/FlowDiagram/.test(tsx)) return "flow";
  if (/ListRevealGrid/.test(tsx)) return "list-reveal";
  if (/HookImageStrip/.test(tsx)) return "hook";
  if (/VisualBlock/.test(tsx)) return "visual-mix";
  if (/bs-scene|bs-headline|Beat Scene/.test(tsx)) return "beat-scene";
  if (/asd-cover-h|Magazine|masthead/.test(tsx)) return "magazine";
  return undefined;
}

function resolveCraftForceTemplate(
  checklist:
    | { appliedTemplate?: string; chapterSource?: { templateKind?: string } }
    | undefined,
  explicitChapterKind?: WvpChapterKind,
): WvpChapterKind | undefined {
  if (explicitChapterKind && WVP_TEMPLATE_KINDS.has(explicitChapterKind)) {
    return explicitChapterKind;
  }
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

async function chapterIllustrationFilesInPresentation(
  presentationDir: string,
  wvpChapterId: string,
): Promise<boolean> {
  const dir = join(presentationDir, "public", "images", wvpChapterId);
  try {
    const names = await readdir(dir);
    return names.some((n) => STEP_IMAGE_FILE_RE.test(n));
  } catch {
    return false;
  }
}

async function chapterIllustrationFilesOnDisk(
  projectId: string,
  wvpChapterId: string,
): Promise<boolean> {
  return chapterIllustrationFilesInPresentation(
    presentationDirForProject(projectId),
    wvpChapterId,
  );
}

/** 掃描 presentation/public/animations 已寫入且可播放的步驟索引（0-based） */
async function chapterAnimationStepsInPresentation(
  presentationDir: string,
  wvpChapterId: string,
): Promise<number[]> {
  const { indices } = await loadStepAnimationHtmlMap(presentationDir, wvpChapterId);
  return indices;
}

/** checklist 內快取 TSX 未嵌入磁碟上已同步的配圖／動畫時，必須重產章節程式 */
function cachedChapterSourceMissingPackagedAssets(
  llmTsx: string,
  hasImagesOnDisk: boolean,
  animationStepsOnDisk: number[],
): boolean {
  if (!llmTsx.trim()) return false;
  const referencesStepImages =
    /stepImageUrl|STEP_IMAGE_EXT|introImageUrl|imageUrl\s*:/.test(llmTsx);
  const referencesStepAnimations =
    /stepAnimationSrcDoc|stepAnimationUrl|STEP_ANIMATION_SET|introAnimationHtml|introAnimationUrl|animationHtml\s*:|animationUrl\s*:/.test(
      llmTsx,
    );
  if (hasImagesOnDisk && !referencesStepImages) return true;
  if (animationStepsOnDisk.length > 0 && !referencesStepAnimations) return true;
  if (referencesStepAnimations && animationStepsOnDisk.length === 0) return true;
  if (
    llmTsx.includes("stepAnimationUrl") &&
    !/function stepAnimationUrl|STEP_ANIMATION_SET/.test(llmTsx)
  ) {
    return true;
  }
  if (
    llmTsx.includes("stepAnimationSrcDoc") &&
    !/STEP_ANIMATION_HTML|function stepAnimationSrcDoc/.test(llmTsx)
  ) {
    return true;
  }
  return false;
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

export type BuildSingleChapterPreviewOpts = {
  themeId?: string;
  onStage?: (stage: string) => Promise<void> | void;
  /** 第 1 章試執行：寫入 anchorChapterTrialCompleted */
  markAnchorTrial?: boolean;
};

/** 單章試跑預覽：僅註冊指定章節、略過語音門檻、打包 dist */
export async function buildSingleChapterPreview(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  wvpChapterId: string,
  opts?: BuildSingleChapterPreviewOpts,
): Promise<{
  built: boolean;
  wvpChapterId: string;
  chapterTitle: string;
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

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  const target = craft as CraftRow | null;
  if (!target) throw new Error("找不到章節");

  const previewStartedAt = Date.now();
  console.log(
    `[wvp-chapter-preview] start project=${projectId} chapter=${wvpChapterId} title="${target.title}" markAnchorTrial=${Boolean(opts?.markAnchorTrial)}`,
  );

  const narrations = target.checklist_result?.narrations?.filter(Boolean) ?? [];
  if (narrations.length === 0) {
    throw new Error(`「${target.title}」尚無口播步驟，請先匯入口播`);
  }
  if (!target.checklist_result?.chapterSource) {
    throw new Error(`「${target.title}」尚無畫面程式，請先按「AI 畫面」或試執行`);
  }

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
      [target] as Parameters<typeof syncPresentationIllustrations>[5],
      wvpSettings.assets,
      styleFragment,
      themeId,
      craftPackIllustrationOpts,
    );
    const hasLocalImages = await chapterIllustrationFilesOnDisk(projectId, target.wvp_chapter_id);
    const studioMarkedDone = stepIllustrationsMarkedDone(target);
    if (illus.written + illus.reusedExisting === 0 && !hasLocalImages) {
      illustrationSyncWarning = studioMarkedDone
        ? "配圖無法寫入預覽目錄，請在「視覺動效」重新上傳或生圖後再試執行。"
        : "試跑未找到已完成的配圖；請先在「視覺動效」生圖或上傳。";
    }
  }

  await syncPresentationStepAnimations(
    supabase,
    userId,
    projectId,
    presentationDir,
    [target],
  ).catch((e) =>
    console.warn("[wvp-chapter-preview] step animation sync failed:", (e as Error).message),
  );

  const previewChapter = resolveCompositionChapterForCraft(composition, target);
  const previewScreens = previewChapter
    ? screenContentsForChapter(composition, previewChapter.id)
    : [];
  await syncHeuristicExplainAnimations(presentationDir, {
    wvpChapterId: target.wvp_chapter_id,
    narrations,
    screenContents: previewScreens,
    themeId,
    craft: target,
  }).catch((e) =>
    console.warn("[wvp-chapter-preview] heuristic explain animation sync failed:", (e as Error).message),
  );

  const entries = await rebuildRegistryForProject(
    presentationDir,
    [target],
    composition,
    wvpSettings.assets,
    { forceFreshChapterSource: Boolean(opts?.markAnchorTrial) },
  );
  if (entries.length === 0) {
    throw new Error(`「${target.title}」尚無可打包的步驟`);
  }

  const base = `/projects/${projectId}/wvp-embed/`;
  await opts?.onStage?.("vite-build-start");
  console.log(`[wvp-chapter-preview] vite build start project=${projectId} chapter=${wvpChapterId}`);
  const viteStartedAt = Date.now();
  try {
    await buildProjectPresentation(projectId, base);
  } finally {
    await opts?.onStage?.("vite-build-done");
  }
  console.log(
    `[wvp-chapter-preview] vite build done project=${projectId} chapter=${wvpChapterId} elapsed=${Math.round((Date.now() - viteStartedAt) / 1000)}s`,
  );

  logWvpBuildQuality(composition, themeId);

  const revisionPrefix = opts?.markAnchorTrial ? "anchor-trial" : "chapter-preview";
  const presentationRevision = `${revisionPrefix}-${wvpChapterId}-${Date.now()}`;
  const nextSettings = opts?.markAnchorTrial
    ? { ...wvpSettings, themeId, anchorChapterTrialCompleted: true }
    : { ...wvpSettings, themeId };
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
      console.warn("[wvp-chapter-preview] dist 上傳 Storage 失敗:", msg);
      throw new Error(
        `試執行建置完成但無法上傳預覽（${msg}）。請稍後重試或檢查 Storage 設定。`,
      );
    } finally {
      await opts?.onStage?.("dist-upload-done");
    }
  }

  console.log(
    `[wvp-chapter-preview] done project=${projectId} chapter=${wvpChapterId} elapsed=${Math.round((Date.now() - previewStartedAt) / 1000)}s`,
  );
  return {
    built: true,
    wvpChapterId: target.wvp_chapter_id,
    chapterTitle: target.title,
    illustrationSyncWarning,
  };
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
  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("wvp_chapter_id")
    .eq("project_id", projectId)
    .order("sort_order")
    .limit(1);
  const firstId = (crafts ?? [])[0]?.wvp_chapter_id;
  if (!firstId) throw new Error("請先建立章節清單");

  const build = await buildSingleChapterPreview(supabase, projectId, userId, firstId, {
    ...opts,
    markAnchorTrial: true,
  });
  return {
    built: build.built,
    wvpChapterId: build.wvpChapterId,
    illustrationSyncWarning: build.illustrationSyncWarning,
  };
}

export async function syncFullWvpProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts?: {
    themeId?: string;
    build?: boolean;
    previewBase?: string;
    onBuildStage?: (phase: WvpBuildPhase, chapterCount?: number) => void | Promise<void>;
  },
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

  const preserveApprovedAnchorChapter = Boolean(wvpSettings.anchorChapterApproved);
  const entries = await rebuildRegistryForProject(
    presentationDir,
    (crafts ?? []) as CraftRow[],
    composition,
    wvpSettings.assets,
    { preserveApprovedAnchorChapter },
  );

  let built = false;
  let distDir: string | undefined;
  let chaptersVisualUpgraded: string[] | undefined;
  let storageUploaded = false;
  let storageUploadWarning: string | undefined;
  let audioSyncWarning: string | undefined;
  let illustrationSyncWarning: string | undefined;
  if (opts?.build && entries.length > 0) {
    const buildStartedAt = Date.now();
    const emitStage = opts.onBuildStage;
    console.log(
      `[wvp-build] sync start project=${projectId} chapters=${entries.length} theme=${themeId}`,
    );
    await emitStage?.("prepare", entries.length);
    invalidateWvpDistCaches(userId, projectId);
    const audioGate = evaluateWvpAudioBuildGate(composition);
    if (!audioGate.ready) {
      console.warn(`[wvp-build] audio gate blocked project=${projectId}: ${audioGate.message}`);
      throw new Error(audioGate.message ?? "請先完成語音合成");
    }

    await syncCheckpointAssetsToPresentation(projectId, wvpSettings.assets);
    console.log(`[wvp-build] checkpoint assets synced project=${projectId}`);
    await emitStage?.("assets", entries.length);

    const audioSync = await syncPresentationAudioFromComposition(
      supabase,
      projectId,
      composition,
      (crafts ?? []) as CraftRow[],
    );
    console.log(
      `[wvp-build] audio sync project=${projectId} written=${audioSync.written}/${audioSync.expectedSteps} compositionAudio=${audioSync.compositionAudioCount}`,
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
    await emitStage?.("audio", entries.length);

    // 先把「章節配圖」（整章一張圖）複製成各步驟本機圖片，
    // 讓後續 syncPresentationIllustrations 的 reuseExistingFiles 路徑能掃到
    for (const craft of (crafts ?? []) as CraftRow[]) {
      if (chapterHasStepExplainAnimations(craft)) continue;

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
    await emitStage?.("illustrations", entries.length);
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
      console.log(
        `[wvp-build] illustrations project=${projectId} mode=${illusMode} written=${illus.written} reused=${illus.reusedExisting} attempted=${illus.attempted}`,
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

      await emitStage?.("animations", entries.length);
      await syncPresentationStepAnimations(
        supabase,
        userId,
        projectId,
        presentationDir,
        (crafts ?? []) as CraftRow[],
      ).catch((e) =>
        console.warn("[wvp-build] step animation sync failed:", (e as Error).message),
      );

      for (const craft of (crafts ?? []) as CraftRow[]) {
        const ch = resolveCompositionChapterForCraft(composition, craft);
        const chNarrations = ch ? narrationsForChapter(composition, ch.id) : [];
        const chScreens = ch ? screenContentsForChapter(composition, ch.id) : [];
        if (chNarrations.length === 0) continue;
        await syncHeuristicExplainAnimations(presentationDir, {
          wvpChapterId: craft.wvp_chapter_id,
          narrations: chNarrations,
          screenContents: chScreens,
          themeId,
          craft,
        }).catch((e) =>
          console.warn(
            `[wvp-build] heuristic explain animation sync failed for ${craft.wvp_chapter_id}:`,
            (e as Error).message,
          ),
        );
      }

      await rebuildRegistryForProject(
        presentationDir,
        (crafts ?? []) as CraftRow[],
        composition,
        wvpSettings.assets,
        { preserveApprovedAnchorChapter },
      );
    } else {
      await emitStage?.("animations", entries.length);
    }

    await emitStage?.("registry", entries.length);

    const base = opts.previewBase ?? `/projects/${projectId}/wvp-embed/`;
    await emitStage?.("vite", entries.length);
    console.log(`[wvp-build] vite build start project=${projectId} base=${base}`);
    const viteStartedAt = Date.now();
    const result = await buildProjectPresentation(projectId, base);
    console.log(
      `[wvp-build] vite build done project=${projectId} elapsed=${Math.round((Date.now() - viteStartedAt) / 1000)}s dist=${result.distDir}`,
    );
    logWvpBuildQuality(composition, themeId);
    distDir = result.distDir;
    built = true;
    chaptersVisualUpgraded = result.chaptersVisualUpgraded;
    try {
      await emitStage?.("upload", entries.length);
      console.log(`[wvp-build] storage upload start project=${projectId}`);
      await uploadWvpDistToStorage(supabase, userId, projectId);
      storageUploaded = true;
      console.log(`[wvp-build] storage upload done project=${projectId}`);
    } catch (e) {
      const msg = (e as Error).message;
      storageUploadWarning = msg;
      console.warn(`[wvp-build] storage upload failed project=${projectId}:`, msg);
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
    console.log(
      `[wvp-build] sync done project=${projectId} elapsed=${Math.round((Date.now() - buildStartedAt) / 1000)}s built=${built} storageUploaded=${storageUploaded}`,
    );
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
