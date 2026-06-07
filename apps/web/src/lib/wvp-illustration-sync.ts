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
  normalizeStepImageExt,
  wvpStepImageFileName,
  writePresentationIllustrationFiles,
} from "@courseflow/presentation";
import { decryptApiKey } from "@/lib/crypto";
import { listConfiguredLlmProviders, resolveEffectiveTextModel, resolveEffectiveImageModel } from "@/lib/llm-provider";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { narrationsForChapter, orderedWvpStepsForChapter } from "@/lib/wvp-chapters";
import { resolveCompositionChapterForCraft, screenContentsForChapter } from "@/lib/wvp-chapter-meta";
import type { WvpAssetRef } from "@/lib/wvp-settings";
import type { StepVisualDecision } from "@/lib/wvp-step-visual-config";

function checkpointAssetForStep(
  assets: WvpAssetRef[] | undefined,
  wvpChapterId: string,
  stepIndex: number,
): WvpAssetRef | undefined {
  if (!assets?.length) return undefined;
  const list = assets.filter(
    (a) => a.url?.trim() && (!a.wvpChapterId || a.wvpChapterId === wvpChapterId),
  );
  const exact = list.find((a) => a.step === stepIndex);
  if (exact) return exact;
  if (stepIndex === 0) return list.find((a) => a.step === 0) ?? list[0];
  return undefined;
}

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  checklist_result?: unknown;
};

type CraftIllustrationState = {
  stepIndex: number;
  needsImage?: boolean;
  imageSource?: "ai" | "upload";
  imageWritten?: boolean;
  status?: string;
  storagePath?: string | null;
  imageExt?: string;
};

function decisionByStep(
  decisions: StepVisualDecision[] | undefined,
  stepIndex: number,
): StepVisualDecision | undefined {
  return decisions?.find((d) => d.step === stepIndex);
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

export type WvpIllustrationSyncOptions = {
  /** 打包路徑：略過 Visual Director LLM（配圖應在 Craft 階段完成） */
  skipVisualDirector?: boolean;
  /** 若 public/images 已有檔案則不重算／重下 */
  reuseExistingFiles?: boolean;
};

export type WvpIllustrationSyncResult = {
  written: number;
  attempted: number;
  skippedNoKey: boolean;
  directorSkipped: number;
  reusedExisting: number;
};

function chapterTemplateKind(craft: CraftRow): string | undefined {
  const cr = craft.checklist_result as
    | {
        chapterSource?: { templateKind?: string };
        appliedTemplate?: string;
        narrations?: string[];
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

/** 哪些 WVP 步驟需要配圖（避免 cover／幽靈格／純圖表步硬塞圖） */
export function wvpStepNeedsIllustration(
  templateKind: string | undefined,
  stepIndex: number,
  totalSteps: number,
): boolean {
  if (totalSteps <= 0) return false;
  const kind = templateKind ?? "magazine";
  if (kind === "hook") return false;
  if (kind === "visual-mix") return false;
  if (kind === "list-reveal") return stepIndex >= 0;
  if (kind === "flow") return stepIndex >= 0;
  if (kind === "magazine") return stepIndex >= 1;
  return stepIndex >= 1;
}

async function downloadBuffer(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from("courseflow-assets")
    .download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function imageFromCompositionStep(
  supabase: SupabaseClient,
  composition: CourseComposition,
  stepId: string,
): Promise<Buffer | null> {
  const visual = composition.visuals.find((v) => v.stepId === stepId);
  if (!visual) return null;
  const imgEl = visual.elements.find((e) => e.type === "image");
  if (imgEl?.storagePath) {
    const buf = await downloadBuffer(supabase, imgEl.storagePath);
    if (buf?.length) return buf;
  }
  if (visual.background.type === "image" && visual.background.storagePath) {
    return downloadBuffer(supabase, visual.background.storagePath);
  }
  return null;
}

/** 各版型：依 WVP 步驟寫入 public/images/<章節>/01.jpg … */
export async function syncPresentationIllustrations(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectTitle: string,
  composition: CourseComposition,
  crafts: CraftRow[],
  projectAssets?: WvpAssetRef[],
  styleFragment?: string,
  themeId = "midnight-press",
  syncOpts?: WvpIllustrationSyncOptions,
): Promise<WvpIllustrationSyncResult> {
  const presentationDir = presentationDirForProject(projectId);
  const configured = await listConfiguredLlmProviders(supabase, userId);
  const imageProviders = IMAGE_GENERATION_PROVIDERS.filter((p) =>
    configured.includes(p),
  );
  const textProviders = configured;
  const imageProvider: LlmProviderId | undefined = imageProviders[0];
  const textProvider: LlmProviderId | undefined = textProviders[0];

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
  let resolvedTextModel: string | undefined;
  if (textProvider) {
    const { data: textKeyRow } = await supabase
      .from("user_api_keys")
      .select("encrypted_key, default_model, text_model")
      .eq("user_id", userId)
      .eq("provider", textProvider)
      .maybeSingle();
    if (textKeyRow?.encrypted_key) {
      textApiKey = decryptApiKey(textKeyRow.encrypted_key);
      resolvedTextModel = resolveEffectiveTextModel(
        textProvider,
        (textKeyRow as { text_model?: string | null }).text_model,
        (textKeyRow as { default_model?: string | null }).default_model,
      );
    }
  }

  const theme = await loadDesignTokensForTheme(themeId);
  const directorLlm =
    textProvider && textApiKey
      ? async (system: string, user: string) => {
          const obj = await generateChapterPlan({
            provider: textProvider,
            apiKey: textApiKey,            model: resolvedTextModel,            system,
            user,
          });
          return JSON.stringify(obj);
        }
      : undefined;

  const files: {
    wvpChapterId: string;
    stepIndex: number;
    buffer: Buffer;
    ext?: import("@courseflow/presentation").WvpStepImageExt;
  }[] = [];
  let attempted = 0;
  let directorSkipped = 0;
  let reusedExisting = 0;
  const reuseExistingFiles = syncOpts?.reuseExistingFiles !== false;
  const skipVisualDirector = syncOpts?.skipVisualDirector === true;

  for (const craft of crafts) {
    const kind = chapterTemplateKind(craft);

    const chapter = resolveCompositionChapterForCraft(composition, craft);
    if (!chapter) continue;

    const narrations = narrationsForChapter(composition, chapter.id);

    const illustrationStates =
      (
        craft.checklist_result as {
          stepIllustrations?: CraftIllustrationState[];
          stepVisualDecisions?: StepVisualDecision[];
        } | null | undefined
      )?.stepIllustrations ?? [];
    const stepVisualDecisions =
      (
        craft.checklist_result as {
          stepVisualDecisions?: StepVisualDecision[];
        } | null | undefined
      )?.stepVisualDecisions ?? [];

    const wvpSteps = orderedWvpStepsForChapter(composition, chapter.id);
    const screenContents = screenContentsForChapter(composition, chapter.id);
    const chapterConsistencyHint = buildChapterConsistencyHint(
      craft.title,
      narrations,
      screenContents,
    );

    for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
      const wvpStep = wvpSteps[stepIndex];
      const compStep = wvpSteps[stepIndex];
      const isDivider = Boolean(wvpStep && isChapterStep(wvpStep));

      const state = illustrationStates.find((s) => s.stepIndex === stepIndex);
      const decision = decisionByStep(stepVisualDecisions, stepIndex);
      const decisionAllowsAi = decision
        ? decision.recommendedOutput === "ai-image"
        : undefined;
      // 使用者在「視覺動效」明確取消勾選「需要配圖」時，無論先前是否已生圖，一律略過
      if (state?.needsImage === false) continue;

      const hasStudioImage =
        state?.imageWritten === true ||
        state?.status === "done" ||
        state?.imageSource === "upload";
      const shouldIllustrate =
        hasStudioImage ||
        (state?.needsImage ??
          decision?.shouldIllustrate ??
          (isDivider ? false : wvpStepNeedsIllustration(kind, stepIndex, narrations.length)));
      const source = state?.imageSource ?? "ai";
      // 步驟層級：imageSource 僅有 "ai" | "upload"，章節配圖另由 chapterIllustration 處理
      if (!shouldIllustrate) continue;
      if (decisionAllowsAi === false && !hasStudioImage) continue;

      if (reuseExistingFiles) {
        const { readChapterIllustrationImage } = await import("@/lib/wvp-craft-illustrations");
        let existingBuf = await readChapterIllustrationImage(
          supabase,
          userId,
          projectId,
          craft.wvp_chapter_id,
          stepIndex,
          {
            storagePath: state?.storagePath,
            imageExt: state?.imageExt ? normalizeStepImageExt(state.imageExt) : undefined,
          },
        );
        if (!existingBuf?.length && compStep) {
          existingBuf = await imageFromCompositionStep(supabase, composition, compStep.id);
        }
        if (existingBuf?.length) {
          const { detectStepImageExtFromBuffer } = await import("@courseflow/presentation");
          files.push({
            wvpChapterId: craft.wvp_chapter_id,
            stepIndex,
            buffer: existingBuf,
            ext: detectStepImageExtFromBuffer(existingBuf),
          });
          reusedExisting++;
          continue;
        }
      }

      if (decision?.recommendedOutput === "animation") continue;

      attempted++;
      const narration = narrations[stepIndex] ?? "";
      const screen = screenContents[stepIndex]?.trim() ?? compStep?.screenContent?.trim() ?? "";
      const script = compStep?.script?.trim() ?? narration;
      let buffer: Buffer | null = null;

      const checkpoint = checkpointAssetForStep(
        projectAssets,
        craft.wvp_chapter_id,
        stepIndex,
      );
      if (checkpoint?.url?.trim()) {
        try {
          const res = await fetch(checkpoint.url.trim(), { cache: "no-store" });
          if (res.ok) buffer = Buffer.from(await res.arrayBuffer());
        } catch {
          /* fall through */
        }
      }

      if (compStep && !buffer) {
        buffer = await imageFromCompositionStep(supabase, composition, compStep.id);
      }

      let directorPlan: VisualDirectorPlan | undefined;
      if (directorLlm && !skipVisualDirector) {
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

          if (directorPlan.recommendedOutput !== "ai-image") {
            directorSkipped++;
            continue;
          }
        } catch (e) {
          console.warn(
            `[wvp] Visual Director 失敗 ${craft.wvp_chapter_id} step ${stepIndex + 1}:`,
            (e as Error).message,
          );
        }
      }

      if (!buffer && source === "ai" && imageApiKey && imageProvider) {
        try {
          const bytes = await generateStepImage(
            { provider: imageProvider, apiKey: imageApiKey, model: resolvedImageModel },
            buildStepImagePrompt({
              courseTopic: projectTitle,
              screenContent: screen,
              script,
              styleFragment,
              director: directorPlan ? directorHintsFromPlan(directorPlan) : undefined,
              chapterConsistencyHint,
              stepContinuityRole: stepContinuityRole(stepIndex, narrations.length),
            }),
          );
          buffer = Buffer.from(bytes);
        } catch (e) {
          console.warn(
            `[wvp] ${craft.wvp_chapter_id} step ${stepIndex + 1} 生圖失敗:`,
            (e as Error).message,
          );
        }
      }

      if (buffer?.length) {
        const { detectStepImageExtFromBuffer } = await import("@courseflow/presentation");
        files.push({
          wvpChapterId: craft.wvp_chapter_id,
          stepIndex,
          buffer,
          ext: detectStepImageExtFromBuffer(buffer),
        });
      }
    }
  }

  const written = await writePresentationIllustrationFiles(presentationDir, files);
  return {
    written,
    attempted,
    skippedNoKey: !imageApiKey && attempted > 0 && written === 0,
    directorSkipped,
    reusedExisting,
  };
}
