import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseComposition } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import {
  buildStepImagePrompt,
  generateStepImage,
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
  wvpStepImageFileName,
  writePresentationIllustrationFiles,
} from "@courseflow/presentation";
import { decryptApiKey } from "@/lib/crypto";
import { listConfiguredLlmProviders } from "@/lib/llm-provider";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import { screenContentsForChapter } from "@/lib/wvp-chapter-meta";
import {
  wvpStepNeedsIllustration,
  type WvpIllustrationSyncOptions,
} from "@/lib/wvp-illustration-sync";
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
  /** 圖片來源：ai=AI 生圖；upload=人工上傳 */
  imageSource?: "ai" | "upload";
  /** 是否納入「批次生圖」 */
  batchSelected?: boolean;
  imagePromptEn?: string;
  coreMessage?: string;
  confirmedAt?: string | null;
  imageWritten?: boolean;
  /** Supabase Storage 路徑（雲端持久化，避免 /tmp 遺失） */
  storagePath?: string | null;
  error?: string | null;
};

const CRAFT_ILLUSTRATION_BUCKET = "courseflow-assets";

export function craftIllustrationStoragePath(
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
): string {
  return `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}/${wvpStepImageFileName(stepIndex)}`;
}

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
): Promise<void> {
  const { error } = await supabase.storage.from(CRAFT_ILLUSTRATION_BUCKET).upload(storagePath, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`配圖上傳失敗：${error.message}`);
}

async function localChapterIllustrationExists(
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
): Promise<boolean> {
  try {
    await access(
      join(
        presentationDirForProject(projectId),
        "public",
        "images",
        wvpChapterId,
        wvpStepImageFileName(stepIndex),
      ),
    );
    return true;
  } catch {
    return false;
  }
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

function directorHintsFromPlan(plan: VisualDirectorPlan): StepImageDirectorHints {
  return {
    coreMessage: plan.coreMessage,
    sceneDescription: plan.sceneDescription,
    imagePromptEn: plan.imagePromptEn,
    avoidElements: plan.avoidElements,
    layoutIntegration: plan.layoutIntegration,
  };
}

function readIllustrationsFromChecklist(craft: CraftRow): StepIllustrationEntry[] {
  const cr = craft.checklist_result as { stepIllustrations?: StepIllustrationEntry[] } | null;
  return cr?.stepIllustrations ?? [];
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
  textProvider?: LlmProviderId;
  textApiKey?: string;
}> {
  const configured = await listConfiguredLlmProviders(supabase, userId);
  const imageProviders = IMAGE_GENERATION_PROVIDERS.filter((p) => configured.includes(p));
  const textProviders = configured;
  const imageProvider = imageProviders[0];
  const textProvider = textProviders[0];

  let imageApiKey: string | undefined;
  if (imageProvider) {
    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", userId)
      .eq("provider", imageProvider)
      .maybeSingle();
    if (keyRow?.encrypted_key) imageApiKey = decryptApiKey(keyRow.encrypted_key);
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

  return { imageProvider, imageApiKey, textProvider, textApiKey };
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
  const chapter = composition.chapters.find((c) => c.title === craft.title);
  const cr = craft.checklist_result as { narrations?: string[] } | null | undefined;
  const narrations =
    cr?.narrations?.filter((n) => n?.trim()) ??
    (chapter ? narrationsForChapter(composition, chapter.id) : []);

  const steps: StepIllustrationEntry[] = [];
  for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
    const heuristicNeedsImage = wvpStepNeedsIllustration(kind, stepIndex, narrations.length);

    const existing = stored.find((s) => s.stepIndex === stepIndex);
    const fileName = wvpStepImageFileName(stepIndex);
    const hasLocal = await localChapterIllustrationExists(
      projectId,
      craft.wvp_chapter_id,
      stepIndex,
    );
    const hasStorage = storageNames.has(fileName);
    let imageWritten = hasLocal || hasStorage;
    const lostPersisted =
      (existing?.imageWritten || existing?.status === "done") && !imageWritten;

    const compSteps = chapter
      ? composition.steps
          .filter((s) => s.chapterId === chapter.id && !isChapterStep(s))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    const compStep = compSteps[stepIndex];
    const screen = compStep?.screenContent?.trim() ?? "";
    const script = compStep?.script?.trim() ?? narrations[stepIndex] ?? "";

    if (existing) {
      const storagePath = hasStorage
        ? craftIllustrationStoragePath(userId, projectId, craft.wvp_chapter_id, stepIndex)
        : (existing.storagePath ?? null);
      const imageSource = existing.imageSource ?? "ai";
      const needsImage = existing.needsImage ?? heuristicNeedsImage;
      const batchSelected =
        existing.batchSelected ?? (needsImage && imageSource === "ai");
      steps.push({
        ...existing,
        screenSnippet: screen.slice(0, 120) || existing.screenSnippet,
        scriptSnippet: script.slice(0, 160) || existing.scriptSnippet,
        imageWritten,
        storagePath,
        imageSource,
        needsImage,
        batchSelected,
        status: imageWritten
          ? "done"
          : lostPersisted
            ? "prompt-ready"
            : existing.status === "generating"
              ? "prompt-ready"
              : existing.status,
        error: lostPersisted
          ? "配圖檔案已遺失（請重新生圖）"
          : imageWritten
            ? null
            : existing.error,
      });
      continue;
    }

    steps.push({
      stepIndex,
      screenSnippet: screen.slice(0, 120),
      scriptSnippet: script.slice(0, 160),
      recommendedOutput: "ai-image",
      status: heuristicNeedsImage ? (imageWritten ? "done" : "prompt-draft") : "skip",
      promptForApi: "",
      imageSource: "ai",
      needsImage: heuristicNeedsImage,
      batchSelected: heuristicNeedsImage,
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
  const chapter = composition.chapters.find((c) => c.title === craft.title);
  if (!chapter) throw new Error("找不到對應章節內容");

  const cr = craft.checklist_result as { narrations?: string[] } | null | undefined;
  const narrations =
    cr?.narrations?.filter((n) => n?.trim()) ??
    narrationsForChapter(composition, chapter.id);
  const screenContents = screenContentsForChapter(composition, chapter.id);

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
    if (!wvpStepNeedsIllustration(kind, stepIndex, narrations.length)) continue;
    const shouldRegenerate = !onlySet || onlySet.has(stepIndex);

    const narration = narrations[stepIndex] ?? "";
    const screen = screenContents[stepIndex]?.trim() ?? "";
    const script = narration;
    const prevStep = existing.find((s) => s.stepIndex === stepIndex);
    const forcedNeedsImage = prevStep?.needsImage ?? true;
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
        screenContent: screen || narration.slice(0, 240),
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

    if (recommendedOutput !== "ai-image" && !forcedNeedsImage) {
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
      screenContent: screen || narration.slice(0, 240),
      script,
      styleFragment,
      director: directorPlan ? directorHintsFromPlan(directorPlan) : undefined,
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

export async function patchChapterIllustrationPrompts(
  supabase: SupabaseClient,
  projectId: string,
  craft: CraftRow,
  patches: Array<{
    stepIndex: number;
    promptForApi?: string;
    confirm?: boolean;
    needsImage?: boolean;
    imageSource?: "ai" | "upload";
    batchSelected?: boolean;
  }>,
): Promise<ChapterIllustrationsState> {
  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const steps = readIllustrationsFromChecklist(craft).map((s) => ({ ...s }));

  for (const p of patches) {
    const idx = steps.findIndex((s) => s.stepIndex === p.stepIndex);
    if (idx < 0) continue;
    if (p.promptForApi !== undefined) {
      steps[idx]!.promptForApi = p.promptForApi;
      if (steps[idx]!.status === "prompt-draft") steps[idx]!.status = "prompt-draft";
    }
    if (p.needsImage !== undefined) {
      steps[idx]!.needsImage = p.needsImage;
      if (!p.needsImage && !steps[idx]!.imageWritten) {
        steps[idx]!.status = "skip";
      } else if (p.needsImage && steps[idx]!.status === "skip") {
        steps[idx]!.status = "prompt-draft";
      }
    }
    if (p.imageSource !== undefined) {
      steps[idx]!.imageSource = p.imageSource;
      if (p.imageSource === "upload") {
        steps[idx]!.batchSelected = false;
      }
    }
    if (p.batchSelected !== undefined) {
      steps[idx]!.batchSelected = p.batchSelected;
    }
    if (p.confirm) {
      steps[idx]!.confirmedAt = new Date().toISOString();
      if (steps[idx]!.status !== "skip") steps[idx]!.status = "prompt-ready";
    }
  }

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

export async function generateChapterIllustrationSteps(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftRow,
  stepIndices: number[],
  opts?: { styleFragment?: string; imageStyleId?: string },
): Promise<{ steps: StepIllustrationEntry[]; generated: number }> {
  const { imageProvider, imageApiKey } = await resolveImageLlm(supabase, userId);
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
      const bytes = await generateStepImage(
        { provider: imageProvider, apiKey: imageApiKey },
        step.promptForApi.trim(),
      );
      const buffer = Buffer.from(bytes);
      const storagePath = craftIllustrationStoragePath(
        userId,
        projectId,
        craft.wvp_chapter_id,
        stepIndex,
      );
      await uploadCraftIllustrationToStorage(supabase, storagePath, buffer);
      try {
        await writePresentationIllustrationFiles(presentationDir, [
          {
            wvpChapterId: craft.wvp_chapter_id,
            stepIndex,
            buffer,
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
        error: null,
      };
      generated++;
    } catch (e) {
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
): Promise<ChapterIllustrationsState> {
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
  );
  await uploadCraftIllustrationToStorage(supabase, storagePath, buffer);
  try {
    await writePresentationIllustrationFiles(presentationDirForProject(projectId), [
      { wvpChapterId: craft.wvp_chapter_id, stepIndex, buffer },
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
): Promise<Buffer | null> {
  const path = join(
    presentationDirForProject(projectId),
    "public",
    "images",
    wvpChapterId,
    wvpStepImageFileName(stepIndex),
  );
  try {
    const local = await readFile(path);
    if (local.length) return local;
  } catch {
    /* 改從 Storage 還原 */
  }

  const storagePath = craftIllustrationStoragePath(
    userId,
    projectId,
    wvpChapterId,
    stepIndex,
  );
  const remote = await downloadCraftIllustrationFromStorage(supabase, storagePath);
  if (!remote?.length) return null;

  try {
    await writePresentationIllustrationFiles(presentationDirForProject(projectId), [
      { wvpChapterId, stepIndex, buffer: remote },
    ]);
  } catch {
    /* 快取失敗仍回傳圖片 */
  }
  return remote;
}

/** 與打包路徑共用：僅同步已寫入 presentation 的圖，不跑 Director */
export const craftPackIllustrationOpts: WvpIllustrationSyncOptions = {
  skipVisualDirector: true,
  reuseExistingFiles: true,
};
