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
import { writePresentationIllustrationFiles } from "@courseflow/presentation";
import { decryptApiKey } from "@/lib/crypto";
import { listConfiguredLlmProviders } from "@/lib/llm-provider";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import type { WvpAssetRef } from "@/lib/wvp-settings";

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

export type WvpIllustrationSyncResult = {
  written: number;
  attempted: number;
  skippedNoKey: boolean;
  directorSkipped: number;
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
  if (kind === "list-reveal") return stepIndex >= 1;
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

  const theme = await loadDesignTokensForTheme(themeId);
  const directorLlm =
    textProvider && textApiKey
      ? async (system: string, user: string) => {
          const obj = await generateChapterPlan({
            provider: textProvider,
            apiKey: textApiKey,
            system,
            user,
          });
          return JSON.stringify(obj);
        }
      : undefined;

  const files: { wvpChapterId: string; stepIndex: number; buffer: Buffer }[] = [];
  let attempted = 0;
  let directorSkipped = 0;

  for (const craft of crafts) {
    const kind = chapterTemplateKind(craft);
    if (!kind || kind === "hook" || kind === "visual-mix") continue;

    const chapter = composition.chapters.find((c) => c.title === craft.title);
    if (!chapter) continue;

    const cr = craft.checklist_result as { narrations?: string[] } | null | undefined;
    const narrations =
      cr?.narrations?.filter((n: string) => n?.trim()) ??
      narrationsForChapter(composition, chapter.id);

    const compSteps = composition.steps
      .filter((s) => s.chapterId === chapter.id && !isChapterStep(s))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    for (let stepIndex = 0; stepIndex < narrations.length; stepIndex++) {
      if (!wvpStepNeedsIllustration(kind, stepIndex, narrations.length)) continue;

      attempted++;
      const compStep = compSteps[stepIndex];
      const narration = narrations[stepIndex] ?? "";
      const screen = compStep?.screenContent?.trim() ?? "";
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
      if (directorLlm) {
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

      if (!buffer && imageApiKey && imageProvider) {
        try {
          const bytes = await generateStepImage(
            { provider: imageProvider, apiKey: imageApiKey },
            buildStepImagePrompt({
              courseTopic: projectTitle,
              screenContent: screen || narration.slice(0, 240),
              script,
              styleFragment,
              director: directorPlan ? directorHintsFromPlan(directorPlan) : undefined,
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
        files.push({
          wvpChapterId: craft.wvp_chapter_id,
          stepIndex,
          buffer,
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
  };
}
