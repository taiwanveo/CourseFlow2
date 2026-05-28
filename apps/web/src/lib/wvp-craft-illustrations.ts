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
  imagePromptEn?: string;
  coreMessage?: string;
  confirmedAt?: string | null;
  imageWritten?: boolean;
  error?: string | null;
};

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
  projectId: string,
  craft: CraftRow,
  composition: CourseComposition,
): Promise<ChapterIllustrationsState> {
  const stored = readIllustrationsFromChecklist(craft);
  const presentationDir = presentationDirForProject(projectId);
  const kind = chapterTemplateKind(craft);
  const chapter = composition.chapters.find((c) => c.title === craft.title);
  const cr = craft.checklist_result as { narrations?: string[] } | null | undefined;
  const narrations =
    cr?.narrations?.filter((n) => n?.trim()) ??
    (chapter ? narrationsForChapter(composition, chapter.id) : []);

  const steps: StepIllustrationEntry[] = [];
  for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
    if (!wvpStepNeedsIllustration(kind, stepIndex, narrations.length)) continue;

    const existing = stored.find((s) => s.stepIndex === stepIndex);
    let imageWritten = existing?.imageWritten ?? false;
    try {
      await access(
        join(
          presentationDir,
          "public",
          "images",
          craft.wvp_chapter_id,
          wvpStepImageFileName(stepIndex),
        ),
      );
      imageWritten = true;
    } catch {
      /* no file */
    }

    const compSteps = chapter
      ? composition.steps
          .filter((s) => s.chapterId === chapter.id && !isChapterStep(s))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    const compStep = compSteps[stepIndex];
    const screen = compStep?.screenContent?.trim() ?? "";
    const script = compStep?.script?.trim() ?? narrations[stepIndex] ?? "";

    if (existing) {
      steps.push({
        ...existing,
        screenSnippet: screen.slice(0, 120) || existing.screenSnippet,
        scriptSnippet: script.slice(0, 160) || existing.scriptSnippet,
        imageWritten,
        status: imageWritten
          ? "done"
          : existing.status === "generating"
            ? "prompt-ready"
            : existing.status,
      });
      continue;
    }

    steps.push({
      stepIndex,
      screenSnippet: screen.slice(0, 120),
      scriptSnippet: script.slice(0, 160),
      recommendedOutput: "ai-image",
      status: imageWritten ? "done" : "prompt-draft",
      promptForApi: "",
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
  styleFragment?: string,
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
  const steps: StepIllustrationEntry[] = [];

  for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
    if (!wvpStepNeedsIllustration(kind, stepIndex, narrations.length)) continue;

    const narration = narrations[stepIndex] ?? "";
    const screen = screenContents[stepIndex]?.trim() ?? "";
    const script = narration;
    const prevStep = existing.find((s) => s.stepIndex === stepIndex);

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

    if (recommendedOutput !== "ai-image") {
      steps.push({
        stepIndex,
        screenSnippet: screen.slice(0, 120),
        scriptSnippet: script.slice(0, 160),
        recommendedOutput,
        status: "skip",
        promptForApi: "",
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
      promptForApi: prevStep?.promptForApi?.trim() ? prevStep.promptForApi : promptForApi,
      imagePromptEn: directorPlan?.imagePromptEn,
      coreMessage: directorPlan?.coreMessage,
      confirmedAt: prevStep?.confirmedAt ?? null,
      imageWritten: prevStep?.imageWritten ?? false,
      error: null,
    });
  }

  const merged = mergeChecklistIllustrations(prev, steps);
  await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", craft.wvp_chapter_id);

  return {
    wvpChapterId: craft.wvp_chapter_id,
    templateKind: kind,
    steps,
    updatedAt: merged.stepIllustrationsUpdatedAt as string,
  };
}

export async function patchChapterIllustrationPrompts(
  supabase: SupabaseClient,
  projectId: string,
  craft: CraftRow,
  patches: Array<{
    stepIndex: number;
    promptForApi?: string;
    confirm?: boolean;
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
  opts?: { styleFragment?: string },
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
    if (step.status === "skip" || !step.promptForApi.trim()) continue;

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
      await writePresentationIllustrationFiles(presentationDir, [
        {
          wvpChapterId: craft.wvp_chapter_id,
          stepIndex,
          buffer: Buffer.from(bytes),
        },
      ]);
      steps[idx] = {
        ...step,
        status: "done",
        imageWritten: true,
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

export async function readChapterIllustrationImage(
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
    return await readFile(path);
  } catch {
    return null;
  }
}

/** 與打包路徑共用：僅同步已寫入 presentation 的圖，不跑 Director */
export const craftPackIllustrationOpts: WvpIllustrationSyncOptions = {
  skipVisualDirector: true,
  reuseExistingFiles: true,
};
