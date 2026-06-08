import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseComposition } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import {
  buildStepImagePrompt,
  generateStepImage,
  generateChapterImage,
  buildChapterImagePrompt,
  IMAGE_GENERATION_PROVIDERS,
  type LlmProviderId,
  type StepImageDirectorHints,
} from "@courseflow/llm";
import {
  analyzeStepVisualPlan,
  loadDesignTokensForTheme,
  type VisualDirectorPlan,
} from "@courseflow/visual-config";
import {
  contentTypeForStepImageExt,
  detectStepImageExtFromBuffer,
  detectStepImageExtFromMime,
  isValidImageBuffer,
  isAllowedUploadImage,
  normalizeStepImageExt,
  wvpStepImageFileName,
  writePresentationIllustrationFiles,
  type WvpStepImageExt,
} from "@courseflow/presentation";
import {
  craftIllustrationStoragePath,
  extFromStorageFileName,
  findLocalStepIllustration,
  readStepIllustrationWithMeta,
  storageFileNameForStep,
} from "@/lib/wvp-step-image-resolve";
import { decryptApiKey } from "@/lib/crypto";
import { listConfiguredLlmProviders, resolveEffectiveImageModel } from "@/lib/llm-provider";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";
import { narrationsForChapter, orderedWvpStepsForChapter } from "@/lib/wvp-chapters";
import {
  resolveCompositionChapterForCraft,
  screenContentsForChapter,
} from "@/lib/wvp-chapter-meta";
import {
  resolveStepNeedsImage,
  wvpStepNeedsIllustration,
  type WvpIllustrationSyncOptions,
} from "@/lib/wvp-illustration-sync";
import { normalizeAnimationHtml } from "@/lib/wvp-animation-html";
import {
  craftAnimationStoragePath,
  downloadCraftAnimationFromStorage,
  uploadCraftAnimationToStorage,
} from "@/lib/wvp-animation-sync";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { ensurePresentationScaffolded } from "@/lib/wvp-presentation-sync";
export type StepIllustrationStatus =
  | "skip"
  | "prompt-draft"
  | "prompt-ready"
  | "generating"
  | "done"
  | "failed";

export type StepIllustrationEntry = {
  stepIndex: number;
  screenSnippet: string;
  scriptSnippet: string;
  recommendedOutput: string;
  status: StepIllustrationStatus;
  /** 送進生圖 API 的完整提示詞（使用者可編輯） */
  promptForApi: string;
  /** 產生此提示詞時所使用的風格 ID */
  promptStyleId?: string | null;
  /** 是否需要此步驟配圖（可人工覆寫 AI 判斷） */
  needsImage?: boolean;
  /** 圖片來源：ai=AI 生圖；upload=人工上傳；animation=AI 解說動畫 */
  imageSource?: "ai" | "upload" | "animation";
  /** AI 解說動畫：自包含的 HTML 字串（CSS/SVG/Canvas 動畫） */
  animationHtml?: string | null;
  /** Phase 3：DSL → Framer Motion 場景（優先於 HTML） */
  animationConfig?: Record<string, unknown> | null;
  /** 解說動畫 HTML 的 Supabase Storage 路徑（打包時還原用） */
  animationStoragePath?: string | null;
  /** 是否納入「批次生圖」 */
  batchSelected?: boolean;
  imagePromptEn?: string;
  coreMessage?: string;
  confirmedAt?: string | null;
  imageWritten?: boolean;
  /** Supabase Storage 路徑（雲端持久化，避免 /tmp 遺失） */
  storagePath?: string | null;
  /** 配圖副檔名（上傳 GIF/APNG 等時保留） */
  imageExt?: WvpStepImageExt;
  error?: string | null;
  /** 步驟級解說動效覆寫：auto | none | pattern */
  motionOverrideMode?: "auto" | "none" | "pattern";
  /** 當 motionOverrideMode=pattern 時指定 pattern */
  motionOverridePattern?: string | null;
};

export { craftIllustrationStoragePath } from "@/lib/wvp-step-image-resolve";

const CRAFT_ILLUSTRATION_BUCKET = "courseflow-assets";

async function listChapterIllustrationStorageNames(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
): Promise<Set<string>> {
  const prefix = `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}`;
  const { data, error } = await supabase.storage.from(CRAFT_ILLUSTRATION_BUCKET).list(prefix);
  if (error || !data?.length) return new Set();
  return new Set(data.map((f) => f.name).filter(Boolean) as string[]);
}

async function downloadCraftIllustrationFromStorage(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from(CRAFT_ILLUSTRATION_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.length ? buf : null;
}

async function uploadCraftIllustrationToStorage(
  supabase: SupabaseClient,
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(CRAFT_ILLUSTRATION_BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`配圖上傳失敗：${error.message}`);
}

async function localChapterIllustrationExists(
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
): Promise<boolean> {
  const hit = await findLocalStepIllustration(projectId, wvpChapterId, stepIndex);
  return Boolean(hit?.buffer.length);
}

export type ChapterIllustrationsState = {
  wvpChapterId: string;
  templateKind?: string;
  steps: StepIllustrationEntry[];
  updatedAt?: string;
};

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  checklist_result?: unknown;
};

function chapterTemplateKind(craft: CraftRow): string | undefined {
  const cr = craft.checklist_result as
    | {
        chapterSource?: { templateKind?: string };
        appliedTemplate?: string;
      }
    | null
    | undefined;
  return cr?.chapterSource?.templateKind ?? cr?.appliedTemplate;
}

function buildChapterConsistencyHint(
  chapterTitle: string,
  narrations: string[],
  screenContents: string[],
): string {
  const keyScreens = screenContents
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" / ");
  const keyNarrations = narrations
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((n) => n.slice(0, 42))
    .join(" / ");
  return [
    `Chapter title: ${chapterTitle}`,
    "Keep recurring subject identity consistent across steps (appearance, outfit/material, silhouette).",
    "Keep color palette and lighting mood consistent within chapter; only adjust emphasis by step intent.",
    "Reuse one stable camera grammar (e.g., medium shot + clear focal subject + clean negative space).",
    "Do not switch to unrelated scene genre unless script explicitly requires it.",
    keyScreens ? `Key on-screen concepts: ${keyScreens}` : "",
    keyNarrations ? `Key narration beats: ${keyNarrations}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function stepContinuityRole(stepIndex: number, totalSteps: number): string {
  if (totalSteps <= 1) return "single-step";
  if (stepIndex === 0) return "chapter-opener";
  if (stepIndex >= totalSteps - 1) return "chapter-closing";
  return "chapter-development";
}

function directorHintsFromPlan(plan: VisualDirectorPlan): StepImageDirectorHints {
  return {
    coreMessage: plan.coreMessage,
    sceneDescription: plan.sceneDescription,
    imagePromptEn: plan.imagePromptEn,
    avoidElements: plan.avoidElements,
    layoutIntegration: plan.layoutIntegration,
  };
}

export function readIllustrationsFromChecklist(craft: CraftRow): StepIllustrationEntry[] {
  const cr = craft.checklist_result as { stepIllustrations?: StepIllustrationEntry[] } | null;
  return cr?.stepIllustrations ?? [];
}

/** 本章是否已有至少一步產出 AI 解說動畫（HTML） */
export function chapterHasStepExplainAnimations(craft: CraftRow): boolean {
  return readIllustrationsFromChecklist(craft).some(
    (s) =>
      s.imageSource === "animation" &&
      Boolean(s.animationHtml?.trim() || s.animationStoragePath?.trim()),
  );
}

/**
 * 任一步驟有解說動畫時，整章配圖改回「步進動畫」模式並清除整章固定圖片。
 */
export async function applyStepAnimationChapterOverride(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
): Promise<void> {
  if (!chapterHasStepExplainAnimations(craft)) return;

  await deleteExistingChapterImages(supabase, userId, projectId, craft.wvp_chapter_id);

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const existing = readChapterIllustrationFromChecklist(craft) ?? {
    visualMode: "animation" as const,
    status: "idle" as ChapterIllustrationStatus,
  };
  const entry: ChapterIllustrationEntry = {
    ...existing,
    visualMode: "animation",
    imageWritten: false,
    storagePath: null,
    imageExt: undefined,
    error: null,
    status:
      existing.status === "done" || existing.status === "generating" || existing.status === "failed"
        ? "idle"
        : existing.status,
  };
  const merged = mergeChapterIllustrationEntry(prev, entry);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);
}

function mergeChecklistIllustrations(
  prev: Record<string, unknown>,
  steps: StepIllustrationEntry[],
): Record<string, unknown> {
  return {
    ...prev,
    stepIllustrations: steps,
    stepIllustrationsUpdatedAt: new Date().toISOString(),
  };
}

async function resolveImageLlm(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  imageProvider?: LlmProviderId;
  imageApiKey?: string;
  resolvedImageModel?: string;
  textProvider?: LlmProviderId;
  textApiKey?: string;
}> {
  const configured = await listConfiguredLlmProviders(supabase, userId);
  const imageProviders = IMAGE_GENERATION_PROVIDERS.filter((p) => configured.includes(p));
  const textProviders = configured;
  const imageProvider = imageProviders[0];
  const textProvider = textProviders[0];

  let imageApiKey: string | undefined;
  let resolvedImageModel: string | undefined;
  if (imageProvider) {
    const { data: imageKeyRow } = await supabase
      .from("user_api_keys")
      .select("encrypted_key, default_model, image_model")
      .eq("user_id", userId)
      .eq("provider", imageProvider)
      .maybeSingle();
    if (imageKeyRow?.encrypted_key) {
      imageApiKey = decryptApiKey(imageKeyRow.encrypted_key);
      resolvedImageModel = resolveEffectiveImageModel(
        imageProvider,
        (imageKeyRow as { image_model?: string | null }).image_model,
        (imageKeyRow as { default_model?: string | null }).default_model,
      );
    }
  }

  let textApiKey: string | undefined;
  if (textProvider) {
    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", userId)
      .eq("provider", textProvider)
      .maybeSingle();
    if (keyRow?.encrypted_key) textApiKey = decryptApiKey(keyRow.encrypted_key);
  }

  return { imageProvider, imageApiKey, resolvedImageModel, textProvider, textApiKey };
}

export async function getChapterIllustrationsState(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  composition: CourseComposition,
): Promise<ChapterIllustrationsState> {
  const stored = readIllustrationsFromChecklist(craft);
  const kind = chapterTemplateKind(craft);
  const storageNames = await listChapterIllustrationStorageNames(
    supabase,
    userId,
    projectId,
    craft.wvp_chapter_id,
  );
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  const narrations = chapter ? narrationsForChapter(composition, chapter.id) : [];
  const wvpSteps = chapter ? orderedWvpStepsForChapter(composition, chapter.id) : [];
  const screenContents = chapter ? screenContentsForChapter(composition, chapter.id) : [];

  const steps: StepIllustrationEntry[] = [];
  for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
    const wvpStep = wvpSteps[stepIndex];
    const isDivider = Boolean(wvpStep && isChapterStep(wvpStep));
    const heuristicNeedsImage = isDivider
      ? false
      : wvpStepNeedsIllustration(kind, stepIndex, narrations.length);

    const existing = stored.find((s) => s.stepIndex === stepIndex);
    const storageFile = storageFileNameForStep(storageNames, stepIndex);
    const hasLocal = await localChapterIllustrationExists(
      projectId,
      craft.wvp_chapter_id,
      stepIndex,
    );
    const hasStorage = Boolean(storageFile);
    const resolvedExt = existing?.imageExt
      ? normalizeStepImageExt(existing.imageExt)
      : storageFile
        ? extFromStorageFileName(storageFile)
        : undefined;
    let imageWritten = hasLocal || hasStorage;
    const lostPersisted =
      (existing?.imageWritten || existing?.status === "done") && !imageWritten;

    const compStep = wvpSteps[stepIndex];
    const screen = screenContents[stepIndex]?.trim() ?? compStep?.screenContent?.trim() ?? "";
    const script = compStep?.script?.trim() ?? narrations[stepIndex] ?? "";

    if (existing) {
      const storagePath = hasStorage
        ? craftIllustrationStoragePath(
            userId,
            projectId,
            craft.wvp_chapter_id,
            stepIndex,
            resolvedExt ?? "jpg",
          )
        : (existing.storagePath ?? null);
      let animationHtml = normalizeAnimationHtml(existing.animationHtml);
      if (!animationHtml && existing.animationStoragePath?.trim()) {
        animationHtml = normalizeAnimationHtml(
          await downloadCraftAnimationFromStorage(supabase, existing.animationStoragePath.trim()),
        );
      }
      const imageSource = existing.imageSource ?? "ai";
      const needsImage = resolveStepNeedsImage(heuristicNeedsImage, existing);
      const batchSelected =
        existing.batchSelected ?? (needsImage && imageSource === "ai");
      const resolvedStatus = imageWritten
        ? "done"
        : lostPersisted
          ? "prompt-ready"
          : existing.status === "generating"
            ? "prompt-ready"
            : needsImage
              ? existing.status === "skip"
                ? "prompt-draft"
                : existing.status
              : "skip";
      steps.push({
        ...existing,
        animationHtml,
        recommendedOutput: isDivider ? "chapter-divider" : existing.recommendedOutput,
        screenSnippet: screen.slice(0, 120) || existing.screenSnippet,
        scriptSnippet: script.slice(0, 160) || existing.scriptSnippet,
        imageWritten,
        storagePath,
        imageExt: resolvedExt ?? existing.imageExt,
        imageSource,
        needsImage,
        batchSelected,
        status: resolvedStatus,
        error: lostPersisted
          ? "配圖檔案已遺失（請重新生圖）"
          : imageWritten
            ? null
            : existing.error,
      });
      continue;
    }

    const defaultNeedsImage = heuristicNeedsImage;
    steps.push({
      stepIndex,
      screenSnippet: screen.slice(0, 120),
      scriptSnippet: script.slice(0, 160),
      recommendedOutput: isDivider ? "chapter-divider" : "ai-image",
      status: defaultNeedsImage ? (imageWritten ? "done" : "prompt-draft") : "skip",
      promptForApi: "",
      imageSource: "ai",
      needsImage: defaultNeedsImage,
      batchSelected: defaultNeedsImage,
      imageWritten,
    });
  }

  return {
    wvpChapterId: craft.wvp_chapter_id,
    templateKind: kind,
    steps,
    updatedAt: (craft.checklist_result as { stepIllustrationsUpdatedAt?: string })
      ?.stepIllustrationsUpdatedAt,
  };
}

export async function planChapterIllustrationPrompts(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectTitle: string,
  craft: CraftRow,
  composition: CourseComposition,
  themeId: string,
  imageStyleId: string,
  styleFragment?: string,
  onlyStepIndices?: number[],
): Promise<ChapterIllustrationsState> {
  const { textProvider, textApiKey } = await resolveImageLlm(supabase, userId);
  if (!textProvider || !textApiKey) {
    throw new Error("規劃提示詞需要文字 LLM API Key（OpenAI 或 OpenRouter）");
  }

  await ensurePresentationScaffolded(projectId, themeId);

  const kind = chapterTemplateKind(craft);
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  if (!chapter) throw new Error("找不到對應章節內容");

  const narrations = narrationsForChapter(composition, chapter.id);
  const wvpSteps = orderedWvpStepsForChapter(composition, chapter.id);
  const screenContents = screenContentsForChapter(composition, chapter.id);
  const chapterConsistencyHint = buildChapterConsistencyHint(
    craft.title,
    narrations,
    screenContents,
  );

  const theme = await loadDesignTokensForTheme(themeId);
  const directorLlm = async (system: string, user: string) => {
    const obj = await generateChapterPlan({
      provider: textProvider,
      apiKey: textApiKey,
      system,
      user,
    });
    return JSON.stringify(obj);
  };

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};

  const existing = readIllustrationsFromChecklist(craft);
  const onlySet =
    onlyStepIndices && onlyStepIndices.length > 0 ? new Set(onlyStepIndices) : null;
  const steps: StepIllustrationEntry[] = [];

  for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
    const wvpStep = wvpSteps[stepIndex];
    const isDivider = Boolean(wvpStep && isChapterStep(wvpStep));
    const heuristicNeedsImage = isDivider
      ? false
      : wvpStepNeedsIllustration(kind, stepIndex, narrations.length);
    const prevStep = existing.find((s) => s.stepIndex === stepIndex);
    const forcedNeedsImage = resolveStepNeedsImage(heuristicNeedsImage, prevStep);
    if (!forcedNeedsImage) continue;
    const shouldRegenerate = !onlySet || onlySet.has(stepIndex);

    const narration = narrations[stepIndex] ?? "";
    const screen = screenContents[stepIndex]?.trim() ?? "";
    const script = narration;
    const imageSource = prevStep?.imageSource ?? "ai";
    const batchSelected = prevStep?.batchSelected ?? (forcedNeedsImage && imageSource === "ai");

    if (!shouldRegenerate && prevStep) {
      steps.push({
        ...prevStep,
        screenSnippet: screen.slice(0, 120) || prevStep.screenSnippet,
        scriptSnippet: script.slice(0, 160) || prevStep.scriptSnippet,
        needsImage: forcedNeedsImage,
        imageSource,
        batchSelected,
      });
      continue;
    }
    if (!shouldRegenerate && !prevStep) {
      steps.push({
        stepIndex,
        screenSnippet: screen.slice(0, 120),
        scriptSnippet: script.slice(0, 160),
        recommendedOutput: "ai-image",
        status: "prompt-draft",
        promptForApi: "",
        promptStyleId: imageStyleId,
        needsImage: forcedNeedsImage,
        imageSource,
        batchSelected,
        confirmedAt: null,
        imageWritten: false,
        storagePath: null,
        error: null,
      });
      continue;
    }

    let directorPlan: VisualDirectorPlan | undefined;
    let recommendedOutput = "ai-image";
    try {
      const analyzed = await analyzeStepVisualPlan({
        stepIndex,
        courseTopic: projectTitle,
        screenContent: screen,
        stepScript: script,
        theme,
        llm: directorLlm,
        maxRetries: 2,
      });
      directorPlan = analyzed.plan;
      recommendedOutput = directorPlan.recommendedOutput;
    } catch (e) {
      console.warn(
        `[craft-illus] Visual Director 失敗 ${craft.wvp_chapter_id} step ${stepIndex + 1}:`,
        (e as Error).message,
      );
    }

    const wantsCommentaryAnimation =
      recommendedOutput === "animation" ||
      recommendedOutput === "chart" ||
      recommendedOutput === "table";

    if (recommendedOutput !== "ai-image" && !forcedNeedsImage) {
      if (wantsCommentaryAnimation) {
        const animationPrompt =
          directorPlan?.animationPromptZh?.trim() ||
          directorPlan?.animationPromptEn?.trim() ||
          [screen, script.slice(0, 200)].filter(Boolean).join("\n");
        steps.push({
          stepIndex,
          screenSnippet: screen.slice(0, 120),
          scriptSnippet: script.slice(0, 160),
          recommendedOutput,
          status: "prompt-draft",
          promptForApi: animationPrompt,
          promptStyleId: imageStyleId,
          needsImage: true,
          imageSource: "animation",
          batchSelected: false,
          imagePromptEn: directorPlan?.imagePromptEn,
          coreMessage: directorPlan?.coreMessage,
          confirmedAt: null,
          imageWritten: false,
          storagePath: null,
          error: null,
        });
        continue;
      }
      steps.push({
        stepIndex,
        screenSnippet: screen.slice(0, 120),
        scriptSnippet: script.slice(0, 160),
        recommendedOutput,
        status: "skip",
        promptForApi: "",
        promptStyleId: imageStyleId,
        needsImage: false,
        imageSource,
        batchSelected: false,
        imagePromptEn: directorPlan?.imagePromptEn,
        coreMessage: directorPlan?.coreMessage,
        confirmedAt: null,
        imageWritten: false,
        error: directorPlan?.skipReason ?? "導演建議不需 AI 靜態圖",
      });
      continue;
    }

    const promptForApi = buildStepImagePrompt({
      courseTopic: projectTitle,
      screenContent: screen,
      script,
      styleFragment,
      director: directorPlan ? directorHintsFromPlan(directorPlan) : undefined,
      chapterConsistencyHint,
      stepContinuityRole: stepContinuityRole(stepIndex, narrations.length),
    });

    steps.push({
      stepIndex,
      screenSnippet: screen.slice(0, 120),
      scriptSnippet: script.slice(0, 160),
      recommendedOutput,
      status: prevStep?.confirmedAt ? "prompt-ready" : "prompt-draft",
      promptForApi:
        prevStep?.promptForApi?.trim() && prevStep.promptStyleId === imageStyleId
          ? prevStep.promptForApi
          : promptForApi,
      promptStyleId: imageStyleId,
      needsImage: forcedNeedsImage,
      imageSource,
      batchSelected,
      imagePromptEn: directorPlan?.imagePromptEn,
      coreMessage: directorPlan?.coreMessage,
      confirmedAt: prevStep?.confirmedAt ?? null,
      imageWritten: prevStep?.imageWritten ?? false,
      storagePath: prevStep?.storagePath ?? null,
      error: null,
    });
  }

  const merged = mergeChecklistIllustrations(prev, steps);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  const updatedCraft = { ...craft, checklist_result: merged };
  return getChapterIllustrationsState(supabase, userId, projectId, updatedCraft, composition);
}

export function bumpMotionPreferenceRevision<T extends Record<string, unknown>>(
  checklist: T,
): T & { motionPreferenceRevision: number } {
  return { ...checklist, motionPreferenceRevision: Date.now() };
}

export async function patchChapterIllustrationPrompts(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  patches: Array<{
    stepIndex: number;
    promptForApi?: string;
    confirm?: boolean;
    needsImage?: boolean;
    imageSource?: "ai" | "upload" | "animation";
    batchSelected?: boolean;
    animationHtml?: string | null;
    animationConfig?: Record<string, unknown> | null;
    motionOverrideMode?: "auto" | "none" | "pattern";
    motionOverridePattern?: string | null;
  }>,
): Promise<ChapterIllustrationsState> {
  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const steps = readIllustrationsFromChecklist(craft).map((s) => ({ ...s }));
  let motionTouched = false;

  for (const p of patches) {
    let idx = steps.findIndex((s) => s.stepIndex === p.stepIndex);
    if (idx < 0) {
      steps.push({
        stepIndex: p.stepIndex,
        screenSnippet: "",
        scriptSnippet: "",
        recommendedOutput: "ai-image",
        status: "prompt-draft",
        promptForApi: "",
        promptStyleId: null,
        needsImage: true,
        imageSource: "ai",
        batchSelected: true,
        confirmedAt: null,
        imageWritten: false,
        storagePath: null,
        error: null,
      });
      idx = steps.length - 1;
    }
    if (p.promptForApi !== undefined) {
      steps[idx]!.promptForApi = p.promptForApi;
      if (steps[idx]!.status === "prompt-draft") steps[idx]!.status = "prompt-draft";
    }
    if (p.needsImage !== undefined) {
      steps[idx]!.needsImage = p.needsImage;
      if (!p.needsImage && !steps[idx]!.imageWritten) {
        steps[idx]!.status = "skip";
        steps[idx]!.batchSelected = false;
      } else if (p.needsImage && steps[idx]!.status === "skip") {
        steps[idx]!.status = "prompt-draft";
        if ((steps[idx]!.imageSource ?? "ai") === "ai") {
          steps[idx]!.batchSelected = true;
        }
      }
    }
    if (p.imageSource !== undefined) {
      const prevSource = steps[idx]!.imageSource ?? "ai";
      steps[idx]!.imageSource = p.imageSource;
      if (p.imageSource === "upload" || p.imageSource === "animation") {
        steps[idx]!.batchSelected = false;
      }
      if (p.imageSource === "animation") {
        if (!steps[idx]!.animationHtml && !steps[idx]!.animationConfig) {
          steps[idx]!.status =
            steps[idx]!.needsImage === false ? "skip" : "prompt-draft";
          steps[idx]!.imageWritten = false;
          steps[idx]!.storagePath = null;
        }
      } else {
        steps[idx]!.animationHtml = null;
        steps[idx]!.animationConfig = null;
        if (prevSource === "animation" || p.imageSource !== prevSource) {
          steps[idx]!.imageWritten = false;
          steps[idx]!.storagePath = null;
          if (steps[idx]!.needsImage !== false) {
            steps[idx]!.status = steps[idx]!.promptForApi.trim()
              ? steps[idx]!.confirmedAt
                ? "prompt-ready"
                : "prompt-draft"
              : "prompt-draft";
          }
        }
      }
    }
    if (p.animationConfig !== undefined) {
      steps[idx]!.animationConfig = p.animationConfig;
      if (p.animationConfig) {
        steps[idx]!.animationHtml = null;
        steps[idx]!.animationStoragePath = null;
        steps[idx]!.imageSource = "animation";
        steps[idx]!.batchSelected = false;
        steps[idx]!.status = "done";
        steps[idx]!.imageWritten = true;
        steps[idx]!.storagePath = null;
        steps[idx]!.error = null;
      } else if (steps[idx]!.imageSource === "animation" && !steps[idx]!.animationHtml) {
        steps[idx]!.imageWritten = false;
        steps[idx]!.status =
          steps[idx]!.needsImage === false ? "skip" : "prompt-draft";
      }
    }
    if (p.animationHtml !== undefined) {
      const animHtml = normalizeAnimationHtml(p.animationHtml);
      steps[idx]!.animationHtml = animHtml;
      if (animHtml) {
        steps[idx]!.animationConfig = null;
        const animPath = craftAnimationStoragePath(
          userId,
          projectId,
          craft.wvp_chapter_id,
          steps[idx]!.stepIndex,
        );
        await uploadCraftAnimationToStorage(supabase, animPath, animHtml);
        steps[idx]!.animationStoragePath = animPath;
        steps[idx]!.imageSource = "animation";
        steps[idx]!.batchSelected = false;
        steps[idx]!.status = "done";
        steps[idx]!.imageWritten = true;
        steps[idx]!.storagePath = null;
        steps[idx]!.error = null;
      } else if (steps[idx]!.imageSource === "animation") {
        steps[idx]!.animationStoragePath = null;
        steps[idx]!.imageWritten = false;
        steps[idx]!.status =
          steps[idx]!.needsImage === false ? "skip" : "prompt-draft";
      }
    }
    if (p.batchSelected !== undefined) {
      steps[idx]!.batchSelected = p.batchSelected;
    }
    if (p.confirm) {
      steps[idx]!.confirmedAt = new Date().toISOString();
      if (steps[idx]!.status !== "skip") steps[idx]!.status = "prompt-ready";
    }
    if (p.motionOverrideMode !== undefined) {
      steps[idx]!.motionOverrideMode = p.motionOverrideMode;
      if (p.motionOverrideMode !== "pattern") {
        steps[idx]!.motionOverridePattern = null;
      }
      motionTouched = true;
    }
    if (p.motionOverridePattern !== undefined) {
      steps[idx]!.motionOverridePattern = p.motionOverridePattern;
      if (p.motionOverridePattern) {
        steps[idx]!.motionOverrideMode = "pattern";
      }
      motionTouched = true;
    }
  }

  const baseMerged = mergeChecklistIllustrations(prev, steps);
  const merged = motionTouched ? bumpMotionPreferenceRevision(baseMerged) : baseMerged;
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  const updatedCraft = { ...craft, checklist_result: merged };
  await applyStepAnimationChapterOverride(supabase, userId, projectId, updatedCraft);

  return {
    wvpChapterId: craft.wvp_chapter_id,
    templateKind: chapterTemplateKind(craft),
    steps,
    updatedAt: merged.stepIllustrationsUpdatedAt as string,
  };
}

/**
 * 用最新的 styleFragment 替換 promptForApi 裡已 baked-in 的舊 style block。
 * 支援兩種格式：
 *  - 英文 director prompt：尋找 "Style reference (palette/mood only): " 行並替換到結尾
 *  - 中文 BananaX prompt：尋找 "【主題配色系統" 標記並替換到結尾
 */
function refreshStyleFragmentInPrompt(prompt: string, newStyleFragment: string): string {
  // 英文格式的 style block 標記
  const enMarker = "\nStyle reference (palette/mood only): ";
  const enIdx = prompt.indexOf(enMarker);
  if (enIdx !== -1) {
    return prompt.slice(0, enIdx) + enMarker + newStyleFragment;
  }

  // 中文格式的 style block 標記
  const zhMarker = "【主題配色系統";
  const zhIdx = prompt.indexOf(zhMarker);
  if (zhIdx !== -1) {
    // 找到 style block 所在行的開頭（往前找 \n）
    const lineStart = prompt.lastIndexOf("\n", zhIdx - 1);
    const cutAt = lineStart !== -1 ? lineStart + 1 : zhIdx;
    // 保留 style block 後面的課程主題/螢幕文字/口播稿等內容（非 style 行）
    // 找到 style block 結束的位置：下一個以「課程主題」開頭的行
    const afterStyle = prompt.indexOf("\n課程主題：", zhIdx);
    if (afterStyle !== -1) {
      return prompt.slice(0, cutAt) + newStyleFragment + prompt.slice(afterStyle);
    }
    return prompt.slice(0, cutAt) + newStyleFragment;
  }

  // 找不到標記，直接附加
  return prompt + "\n" + newStyleFragment;
}

export async function generateChapterIllustrationSteps(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  stepIndices: number[],
  opts?: { styleFragment?: string; imageStyleId?: string },
): Promise<{ steps: StepIllustrationEntry[]; generated: number }> {
  const { imageProvider, imageApiKey, resolvedImageModel } = await resolveImageLlm(supabase, userId);
  if (!imageApiKey || !imageProvider) {
    throw new Error("生圖需要 OpenAI 或 OpenRouter API Key");
  }

  const presentationDir = presentationDirForProject(projectId);
  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const steps = readIllustrationsFromChecklist(craft).map((s) => ({ ...s }));
  let generated = 0;

  for (const stepIndex of stepIndices) {
    const idx = steps.findIndex((s) => s.stepIndex === stepIndex);
    if (idx < 0) continue;
    const step = steps[idx]!;
    if (!step.needsImage) continue;
    if ((step.imageSource ?? "ai") !== "ai") continue;
    if (step.status === "skip" || !step.promptForApi.trim()) continue;
    if (opts?.imageStyleId && step.promptStyleId !== opts.imageStyleId) {
      throw new Error("已切換生圖風格，請先按「產生提示詞」更新後再生圖");
    }

    steps[idx] = { ...step, status: "generating", error: null };
    await supabase
      .from("chapter_craft")
      .update({ checklist_result: mergeChecklistIllustrations(prev, steps) })
      .eq("project_id", projectId)
      .eq("wvp_chapter_id", craft.wvp_chapter_id);

    try {
      // 用最新 styleFragment 替換 prompt 裡可能過時的 style block
      const promptToUse = opts?.styleFragment
        ? refreshStyleFragmentInPrompt(step.promptForApi.trim(), opts.styleFragment)
        : step.promptForApi.trim();
      const bytes = await generateStepImage(
        { provider: imageProvider, apiKey: imageApiKey, model: resolvedImageModel },
        promptToUse,
      );
      const buffer = Buffer.from(bytes);
      if (!isValidImageBuffer(buffer)) {
        throw new Error("生圖 API 回傳非圖片內容（可能是 HTML 錯誤頁），請重試或更換模型");
      }
      const ext = detectStepImageExtFromBuffer(buffer);
      const storagePath = craftIllustrationStoragePath(
        userId,
        projectId,
        craft.wvp_chapter_id,
        stepIndex,
        ext,
      );
      await uploadCraftIllustrationToStorage(
        supabase,
        storagePath,
        buffer,
        contentTypeForStepImageExt(ext),
      );
      try {
        await writePresentationIllustrationFiles(presentationDir, [
          {
            wvpChapterId: craft.wvp_chapter_id,
            stepIndex,
            buffer,
            ext,
          },
        ]);
      } catch (e) {
        console.warn(
          `[craft-illus] 本機快取寫入失敗 ${craft.wvp_chapter_id} step ${stepIndex + 1}:`,
          (e as Error).message,
        );
      }
      steps[idx] = {
        ...step,
        status: "done",
        imageWritten: true,
        storagePath,
        imageExt: ext,
        imageSource: "ai",
        animationHtml: null,
        error: null,
      };
      generated++;
    } catch (e) {
      console.error("[craft-illus] 生圖失敗 step", stepIndex, {
        name: (e as Error)?.name,
        message: (e as Error)?.message?.slice(0, 300),
        stack: (e as Error)?.stack?.split("\n").slice(0, 5).join(" | "),
        provider: imageProvider,
        model: resolvedImageModel,
      });
      steps[idx] = {
        ...step,
        status: "failed",
        error: (e as Error).message.slice(0, 500),
      };
    }

    await supabase
      .from("chapter_craft")
      .update({ checklist_result: mergeChecklistIllustrations(prev, steps) })
      .eq("project_id", projectId)
      .eq("wvp_chapter_id", craft.wvp_chapter_id);
  }

  return { steps, generated };
}

export async function setChapterIllustrationUploadedImage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  stepIndex: number,
  buffer: Buffer,
  uploadMeta?: { mime?: string; fileName?: string },
): Promise<ChapterIllustrationsState> {
  if (
    uploadMeta?.mime &&
    uploadMeta?.fileName &&
    !isAllowedUploadImage({ type: uploadMeta.mime, name: uploadMeta.fileName })
  ) {
    throw new Error("僅支援 JPG、PNG、BMP、GIF（含 APNG）");
  }
  const ext = uploadMeta?.mime
    ? detectStepImageExtFromMime(uploadMeta.mime, uploadMeta.fileName)
    : detectStepImageExtFromBuffer(buffer);
  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const steps = readIllustrationsFromChecklist(craft).map((s) => ({ ...s }));
  const idx = steps.findIndex((s) => s.stepIndex === stepIndex);
  if (idx < 0) throw new Error("找不到步驟");

  const storagePath = craftIllustrationStoragePath(
    userId,
    projectId,
    craft.wvp_chapter_id,
    stepIndex,
    ext,
  );
  await uploadCraftIllustrationToStorage(
    supabase,
    storagePath,
    buffer,
    contentTypeForStepImageExt(ext),
  );
  try {
    await writePresentationIllustrationFiles(presentationDirForProject(projectId), [
      { wvpChapterId: craft.wvp_chapter_id, stepIndex, buffer, ext },
    ]);
  } catch {
    /* 快取失敗可忽略 */
  }

  steps[idx] = {
    ...steps[idx]!,
    needsImage: true,
    imageSource: "upload",
    batchSelected: false,
    status: "done",
    imageWritten: true,
    storagePath,
    imageExt: ext,
    animationHtml: null,
    error: null,
  };

  const merged = mergeChecklistIllustrations(prev, steps);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  return {
    wvpChapterId: craft.wvp_chapter_id,
    templateKind: chapterTemplateKind(craft),
    steps,
    updatedAt: merged.stepIllustrationsUpdatedAt as string,
  };
}

export async function readChapterIllustrationImage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
  hint?: { storagePath?: string | null; imageExt?: WvpStepImageExt },
): Promise<Buffer | null> {
  const hit = await readStepIllustrationWithMeta(
    supabase,
    userId,
    projectId,
    wvpChapterId,
    stepIndex,
    hint?.imageExt,
    hint?.storagePath,
  );
  if (!hit?.buffer.length) return null;
  try {
    await writePresentationIllustrationFiles(presentationDirForProject(projectId), [
      { wvpChapterId, stepIndex, buffer: hit.buffer, ext: hit.ext },
    ]);
  } catch {
    /* 快取失敗仍回傳圖片 */
  }
  return hit.buffer;
}

export async function readChapterIllustrationContentType(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
): Promise<string | null> {
  const hit = await readStepIllustrationWithMeta(
    supabase,
    userId,
    projectId,
    wvpChapterId,
    stepIndex,
  );
  if (!hit) return null;
  return contentTypeForStepImageExt(hit.ext);
}

/** 與打包路徑共用：優先沿用既有圖片，缺圖時允許 Director 做內容感知決策 */
export const craftPackIllustrationOpts: WvpIllustrationSyncOptions = {
  skipVisualDirector: false,
  reuseExistingFiles: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// 章節層級配圖（Chapter-level illustration）
// 一章一張圖，覆寫章節內所有步驟的背景，步驟推進只換音訊/字幕，圖不動。
// ─────────────────────────────────────────────────────────────────────────────

export type ChapterIllustrationStatus =
  | "idle"
  | "prompt-draft"
  | "prompt-ready"
  | "generating"
  | "done"
  | "failed";

export type ChapterIllustrationEntry = {
  /** "animation" = 預設步進動畫（未覆寫）；"ai-image" / "upload" = 已覆寫為固定圖片背景 */
  visualMode: "animation" | "ai-image" | "upload";
  status: ChapterIllustrationStatus;
  promptForApi?: string;
  promptStyleId?: string | null;
  coreMessage?: string;
  confirmedAt?: string | null;
  imageWritten?: boolean;
  storagePath?: string | null;
  imageExt?: WvpStepImageExt;
  error?: string | null;
};

const CHAPTER_IMAGE_FILENAME = "chapter";

export function chapterImageStoragePath(
  userId: string,
  projectId: string,
  wvpChapterId: string,
  ext: WvpStepImageExt = "jpg",
): string {
  return `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}/${CHAPTER_IMAGE_FILENAME}.${ext}`;
}

function readChapterIllustrationFromChecklist(craft: CraftRow): ChapterIllustrationEntry | null {
  const cr = craft.checklist_result as { chapterIllustration?: ChapterIllustrationEntry } | null;
  if (!cr?.chapterIllustration) return null;
  return cr.chapterIllustration;
}

function mergeChapterIllustrationEntry(
  prev: Record<string, unknown>,
  entry: ChapterIllustrationEntry,
): Record<string, unknown> {
  return {
    ...prev,
    chapterIllustration: entry,
    chapterIllustrationUpdatedAt: new Date().toISOString(),
  };
}

async function downloadChapterImageFromStorage(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from(CRAFT_ILLUSTRATION_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.length ? buf : null;
}

async function chapterImageExistsInStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
): Promise<{ exists: boolean; ext: WvpStepImageExt | null; storagePath: string | null }> {
  const prefix = `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}`;
  const { data } = await supabase.storage.from(CRAFT_ILLUSTRATION_BUCKET).list(prefix);
  if (!data?.length) return { exists: false, ext: null, storagePath: null };
  const found = data.find((f) => f.name?.startsWith(`${CHAPTER_IMAGE_FILENAME}.`));
  if (!found?.name) return { exists: false, ext: null, storagePath: null };
  const ext = extFromStorageFileName(found.name);
  return {
    exists: true,
    ext,
    storagePath: `${prefix}/${found.name}`,
  };
}

/** 刪除該章節下所有 chapter.* 檔案，確保新圖上傳後不會與舊檔互相干擾 */
async function deleteExistingChapterImages(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
): Promise<void> {
  const prefix = `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}`;
  const { data } = await supabase.storage.from(CRAFT_ILLUSTRATION_BUCKET).list(prefix);
  const toDelete = (data ?? [])
    .filter((f) => f.name?.startsWith(`${CHAPTER_IMAGE_FILENAME}.`))
    .map((f) => `${prefix}/${f.name}`);
  if (toDelete.length > 0) {
    await supabase.storage.from(CRAFT_ILLUSTRATION_BUCKET).remove(toDelete);
  }
}

/** 取得章節配圖狀態（含圖片是否已存在的真實檢查） */
export async function getChapterIllustrationEntryState(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
): Promise<ChapterIllustrationEntry> {
  const stored = readChapterIllustrationFromChecklist(craft);
  const { exists, ext, storagePath } = await chapterImageExistsInStorage(
    supabase,
    userId,
    projectId,
    craft.wvp_chapter_id,
  );

  if (!stored) {
    return {
      visualMode: "animation",
      status: "idle",
    };
  }

  // 優先信任 DB 記錄的 storagePath（由最近一次上傳/生圖寫入，最具權威性）
  // 只在 DB 無記錄時才降級用 storage listing 找到的路徑
  const resolvedStoragePath = stored.storagePath?.trim()
    ? stored.storagePath
    : exists ? storagePath : null;
  const resolvedExt = stored.imageExt ?? (exists ? ext : null) ?? undefined;
  const imageWritten = exists;
  const lostPersisted = (stored.imageWritten || stored.status === "done") && !imageWritten;

  return {
    ...stored,
    storagePath: resolvedStoragePath,
    imageExt: resolvedExt,
    imageWritten,
    status: imageWritten
      ? "done"
      : lostPersisted
        ? "prompt-ready"
        : stored.status === "generating"
          ? "prompt-ready"
          : stored.status,
    error: lostPersisted ? "配圖檔案已遺失（請重新生圖）" : imageWritten ? null : stored.error,
  };
}

/** 更新章節配圖設定（visualMode / prompt / confirm） */
export async function patchChapterIllustrationEntry(
  supabase: SupabaseClient,
  projectId: string,
  craft: CraftRow,
  patch: Partial<ChapterIllustrationEntry> & { confirm?: boolean },
): Promise<ChapterIllustrationEntry> {
  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const existing = readChapterIllustrationFromChecklist(craft) ?? {
    visualMode: "animation" as const,
    status: "idle" as ChapterIllustrationStatus,
  };

  const next: ChapterIllustrationEntry = { ...existing, ...patch };
  if (patch.confirm) {
    next.confirmedAt = new Date().toISOString();
    if (next.status === "prompt-draft") next.status = "prompt-ready";
  }
  // 切換 visualMode 時，重置圖片相關欄位，避免舊圖資訊混入新模式
  if (patch.visualMode !== undefined && patch.visualMode !== existing.visualMode) {
    next.imageWritten = false;
    next.storagePath = null;
    next.imageExt = undefined;
    next.error = null;
    if (next.status === "done" || next.status === "generating" || next.status === "failed") {
      next.status = next.visualMode === "ai-image" ? "idle" : "idle";
    }
  }

  const merged = mergeChapterIllustrationEntry(prev, next);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  return next;
}

/** 用 AI 為整章生成生圖提示詞（一次 LLM 呼叫，回傳 ChapterIllustrationEntry） */
export async function planChapterIllustrationPromptEntry(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectTitle: string,
  craft: CraftRow,
  composition: CourseComposition,
  themeId: string,
  imageStyleId: string,
  styleFragment?: string,
): Promise<ChapterIllustrationEntry> {
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  if (!chapter) throw new Error("找不到對應章節內容");

  const narrations = narrationsForChapter(composition, chapter.id);
  const screenContents = screenContentsForChapter(composition, chapter.id);

  const promptForApi = buildChapterImagePrompt({
    courseTopic: projectTitle,
    chapterTitle: craft.title,
    allScreenContents: screenContents,
    allNarrations: narrations,
    styleFragment,
  });

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const existing = readChapterIllustrationFromChecklist(craft) ?? {
    visualMode: "animation" as const,
    status: "idle" as ChapterIllustrationStatus,
  };

  const entry: ChapterIllustrationEntry = {
    ...existing,
    visualMode: existing.visualMode === "animation" ? "ai-image" : existing.visualMode,
    promptForApi,
    promptStyleId: imageStyleId,
    status: "prompt-draft",
    confirmedAt: null,
    error: null,
  };

  const merged = mergeChapterIllustrationEntry(prev, entry);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  return entry;
}

/** 依已確認提示詞為整章生圖（一張圖片） */
export async function generateChapterIllustrationImageEntry(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  opts?: { styleFragment?: string; imageStyleId?: string },
): Promise<ChapterIllustrationEntry> {
  const { imageProvider, imageApiKey, resolvedImageModel } = await resolveImageLlm(supabase, userId);
  if (!imageApiKey || !imageProvider) {
    throw new Error("生圖需要 OpenAI 或 OpenRouter API Key");
  }

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const existing = readChapterIllustrationFromChecklist(craft);
  if (!existing?.promptForApi?.trim()) {
    throw new Error("尚無提示詞，請先按「AI 產生提示詞」");
  }
  if (opts?.imageStyleId && existing.promptStyleId && existing.promptStyleId !== opts.imageStyleId) {
    throw new Error("已切換生圖風格，請先按「AI 產生提示詞」更新後再生圖");
  }

  const generating: ChapterIllustrationEntry = { ...existing, status: "generating", error: null };
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: mergeChapterIllustrationEntry(prev, generating) })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  try {
    const promptToUse = opts?.styleFragment
      ? refreshStyleFragmentInPrompt(existing.promptForApi.trim(), opts.styleFragment)
      : existing.promptForApi.trim();

    const bytes = await generateChapterImage(
      { provider: imageProvider, apiKey: imageApiKey, model: resolvedImageModel },
      promptToUse,
    );
    const buffer = Buffer.from(bytes);
    const ext = detectStepImageExtFromBuffer(buffer);
    const storagePath = chapterImageStoragePath(userId, projectId, craft.wvp_chapter_id, ext);

    // 删除舊的 chapter.* （如之前上傳的圖片副檔名不同），避免舊檔互擾
    await deleteExistingChapterImages(supabase, userId, projectId, craft.wvp_chapter_id);

    await uploadCraftIllustrationToStorage(
      supabase,
      storagePath,
      buffer,
      contentTypeForStepImageExt(ext),
    );

    const done: ChapterIllustrationEntry = {
      ...existing,
      status: "done",
      imageWritten: true,
      storagePath,
      imageExt: ext,
      error: null,
    };

    await supabase
      .from("chapter_craft")
      .update({ checklist_result: mergeChapterIllustrationEntry(prev, done) })
      .eq("project_id", projectId)
      .eq("wvp_chapter_id", craft.wvp_chapter_id);

    return done;
  } catch (e) {
    const failed: ChapterIllustrationEntry = {
      ...existing,
      status: "failed",
      error: (e as Error).message.slice(0, 500),
    };

    await supabase
      .from("chapter_craft")
      .update({ checklist_result: mergeChapterIllustrationEntry(prev, failed) })
      .eq("project_id", projectId)
      .eq("wvp_chapter_id", craft.wvp_chapter_id);

    throw e;
  }
}

/** 上傳圖片作為章節配圖 */
export async function uploadChapterIllustrationImageEntry(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  buffer: Buffer,
  uploadMeta?: { mime?: string; fileName?: string },
): Promise<ChapterIllustrationEntry> {
  if (
    uploadMeta?.mime &&
    uploadMeta?.fileName &&
    !isAllowedUploadImage({ type: uploadMeta.mime, name: uploadMeta.fileName })
  ) {
    throw new Error("僅支援 JPG、PNG、BMP、GIF（含 APNG）");
  }

  const ext = uploadMeta?.mime
    ? detectStepImageExtFromMime(uploadMeta.mime, uploadMeta.fileName)
    : detectStepImageExtFromBuffer(buffer);

  const storagePath = chapterImageStoragePath(userId, projectId, craft.wvp_chapter_id, ext);

  // 刪除舊的 chapter.* 檔案（如之前 AI 生圖副檔名不同），避免舊檔互擾
  await deleteExistingChapterImages(supabase, userId, projectId, craft.wvp_chapter_id);

  await uploadCraftIllustrationToStorage(
    supabase,
    storagePath,
    buffer,
    contentTypeForStepImageExt(ext),
  );

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const existing = readChapterIllustrationFromChecklist(craft) ?? {
    visualMode: "animation" as const,
    status: "idle" as ChapterIllustrationStatus,
  };

  const entry: ChapterIllustrationEntry = {
    ...existing,
    visualMode: "upload",
    status: "done",
    imageWritten: true,
    storagePath,
    imageExt: ext,
    error: null,
  };

  const merged = mergeChapterIllustrationEntry(prev, entry);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  return entry;
}

/** 讀取章節配圖的原始資料（回傳 buffer + contentType） */
export async function readChapterIllustrationImageEntry(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
  storagePath?: string | null,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  // 1. 優先用已記錄的 storagePath
  if (storagePath?.trim()) {
    const buf = await downloadChapterImageFromStorage(supabase, storagePath.trim());
    if (buf?.length) {
      const ext = extFromStorageFileName(storagePath.trim().split("/").pop() ?? "chapter.jpg");
      return { buffer: buf, contentType: contentTypeForStepImageExt(detectStepImageExtFromBuffer(buf) || ext) };
    }
  }

  // 2. 列舉 Storage 找 chapter.* 檔案
  const { exists, ext, storagePath: foundPath } = await chapterImageExistsInStorage(
    supabase,
    userId,
    projectId,
    wvpChapterId,
  );
  if (exists && foundPath && ext) {
    const buf = await downloadChapterImageFromStorage(supabase, foundPath);
    if (buf?.length) {
      return { buffer: buf, contentType: contentTypeForStepImageExt(ext) };
    }
  }

  return null;
}

/**
 * 將章節配圖（chapterIllustration）從 Supabase Storage 下載並寫入本機所有步驟圖片位置。
 * 在重新產生 AI 視覺前呼叫，確保 codegen 的 resolveStepImageExtMapFromLocalDir 可掃到圖片。
 *
 * @returns 成功寫入的步驟數；0 表示不需要（animation 模式或無圖片）
 */
export async function syncChapterIllustrationToStepImages(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  stepCount: number,
): Promise<number> {
  if (chapterHasStepExplainAnimations(craft)) return 0;

  const entry = readChapterIllustrationFromChecklist(craft);
  if (!entry || entry.visualMode === "animation") return 0;
  if (!entry.imageWritten && !entry.storagePath) return 0;

  const imageData = await readChapterIllustrationImageEntry(
    supabase,
    userId,
    projectId,
    craft.wvp_chapter_id,
    entry.storagePath,
  );
  if (!imageData?.buffer.length) return 0;

  const ext = detectStepImageExtFromBuffer(imageData.buffer) ?? entry.imageExt ?? "jpg";
  const presentationDir = presentationDirForProject(projectId);

  await writePresentationIllustrationFiles(
    presentationDir,
    Array.from({ length: stepCount }, (_, i) => ({
      wvpChapterId: craft.wvp_chapter_id,
      stepIndex: i,
      buffer: imageData.buffer,
      ext: ext as WvpStepImageExt,
    })),
  );
  return stepCount;
}
