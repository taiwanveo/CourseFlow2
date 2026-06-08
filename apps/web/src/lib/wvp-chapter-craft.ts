import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeChecklistResults } from "@courseflow/craft-agent";
import {
  CHAPTER_CRAFT_SYSTEM_PROMPT,
  CHAPTER_SOURCE_SYSTEM_PROMPT,
  buildChapterCraftUserPrompt,
  buildChapterSourceUserPrompt,
} from "@courseflow/craft-agent";
import type { CourseComposition } from "@courseflow/core";
import {
  chapterComponentName,
  generateChapterSources,
  normalizeChapterTsx,
  runChapterCraftChecklist,
  validateChapterTsxIssues,
  formatChapterTsxValidationFeedback,
  checkStepsHaveVisuals,
} from "@courseflow/presentation";
import { isDataVisualChapter } from "@courseflow/presentation/router";
import { buildHeuristicStepVisualConfigs } from "@courseflow/presentation";
import type { WvpChapterKind } from "@courseflow/core";
import { parseWvpSettings, type WvpAnchorProfile } from "@/lib/wvp-settings";
import {
  chapterKindForCraft,
  resolveCompositionChapterForCraft,
  screenContentsForChapter,
} from "@/lib/wvp-chapter-meta";
import type { LlmProviderId } from "@courseflow/llm";
import { decryptApiKey } from "@/lib/crypto";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import { chapterContextForCraft } from "@/lib/wvp-chapter-context";
import {
  ensurePresentationScaffolded,
  rebuildRegistryForProject,
  syncFullWvpProject,
} from "@/lib/wvp-presentation-sync";
import { wvpEmbedBasePath } from "@/lib/wvp-workdir";
import {
  loadCompositionForWvpBuild,
  loadProjectComposition,
} from "@/lib/project-composition";
import { chapterAssetsForCodegen } from "@/lib/wvp-assets";
import type { WvpAssetRef } from "@/lib/wvp-settings";
import {
  resolveStepImageExtMapFromLocalDir,
  resolveStepImageExtMapLocal,
} from "@/lib/wvp-step-image-resolve";
import { syncChapterIllustrationToStepImages } from "@/lib/wvp-craft-illustrations";
import { makeDefaultStepMotions } from "@/lib/wvp-motion-utils";
import {
  generateStepVisualConfigsForChapterBatched,
  type StepVisualDecision,
} from "@/lib/wvp-step-visual-config";
import {
  createInitialBatchProgress,
  resolveBatchConcurrency,
  runPool,
  type WvpBatchCraftProgress,
} from "@courseflow/wvp-craft";
import { parseCssCustomProperties, themesDir } from "@courseflow/wvp-bridge";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

/** 讀取主題 token，失敗時回傳空物件 */
async function loadThemeTokens(themeId: string): Promise<Record<string, string>> {
  try {
    const css = await readFile(join(themesDir(), themeId, "tokens.css"), "utf8");
    return parseCssCustomProperties(css);
  } catch {
    return {};
  }
}

/** 注入給 validateChapterTsx 的 TypeScript syntax checker */
function tsxSyntaxChecker(code: string): boolean {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    reportDiagnostics: true,
  });
  return (result.diagnostics?.length ?? 0) === 0;
}

export type CraftRow = {
  id: string;
  wvp_chapter_id: string;
  title: string;
  sort_order: number;
  step_count: number;
  craft_status: string;
  presentation_path?: string | null;
  checklist_result?: Record<string, unknown> | null;
};

export async function syncChapterNarrations(
  supabase: SupabaseClient,
  projectId: string,
  craft: CraftRow,
  composition: CourseComposition,
): Promise<{ narrations: string[]; error?: string }> {
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  if (!chapter) return { narrations: [], error: "找不到對應章節" };

  const narrations = narrationsForChapter(composition, chapter.id);
  if (narrations.length === 0) {
    return { narrations: [], error: "本章尚無口播步驟，請先在「內容」編輯" };
  }

  const checklist = mergeChecklistResults(craft.wvp_chapter_id, [
    {
      id: "narrations-length",
      label: "narrations.length === 最大 step + 1",
      passed: true,
      evidence: `${narrations.length} steps`,
    },
    {
      id: "list-reveal",
      label: "清單/列表 1 項 = 1 step",
      passed: true,
      evidence: "已依 composition 步驟切分",
    },
  ]);

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? craft.checklist_result
      : {};

  const { error } = await supabase
    .from("chapter_craft")
    .update({
      step_count: narrations.length,
      craft_status: "draft",
      checklist_result: { ...prev, ...checklist, narrations },
    })
    .eq("id", craft.id);

  if (error) return { narrations: [], error: error.message };
  return { narrations };
}

export async function generateChapterCraft(
  supabase: SupabaseClient,
  projectId: string,
  craft: CraftRow,
  opts: {
    provider: LlmProviderId;
    encryptedKey: string;
    textModel?: string | null;
    composition: CourseComposition;
    article: string;
    themeId: string;
    narrations: string[];
    anchorProfile?: WvpAnchorProfile;
    forceTemplate?: WvpChapterKind;
    assets?: WvpAssetRef[];
    userId?: string;
    skipLlmTsx?: boolean;
    anchorChapterApproved?: boolean;
  },
): Promise<{
  ok: boolean;
  chapterSource: "llm" | "template";
  error?: string;
}> {
  const wvpChapterId = craft.wvp_chapter_id;
  const contentChapter = resolveCompositionChapterForCraft(opts.composition, craft);
  const screenContents = contentChapter
    ? screenContentsForChapter(opts.composition, contentChapter.id)
    : [];
  const articleChapterExcerpt = chapterContextForCraft(
    opts.composition,
    contentChapter?.id,
    opts.article,
    craft.title,
  );

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? craft.checklist_result
      : {};

  await supabase
    .from("chapter_craft")
    .update({ craft_status: "generating" })
    .eq("id", craft.id);

  const apiKey = decryptApiKey(opts.encryptedKey);
  const themeTokens = await loadThemeTokens(opts.themeId);

  try {
    const userPrompt = buildChapterCraftUserPrompt({
      wvpChapterId,
      themeId: opts.themeId,
      chapterTitle: craft.title,
      narrations: opts.narrations,
      articleChapterExcerpt,
      anchorProfile: opts.anchorProfile,
    });

    const plan = await generateChapterPlan({
      provider: opts.provider,
      apiKey,
      model: opts.textModel ?? undefined,
      system: CHAPTER_CRAFT_SYSTEM_PROMPT,
      user: `${userPrompt}\n\n請輸出 JSON：{ "chapterKind": "list-reveal"|"flow"|"hook"|"magazine"|"custom", "visualIdeas": string[], "stepBeats": { "step": number, "dominantAction": string }[], "stepVisuals": { "step": number, "concept": string, "vizType": string, "onScreen": string }[] }`,
    });

    let chapterSource: {
      chapterTsx?: string;
      chapterCss?: string;
      chapterDslTs?: string;
      source: "llm" | "template";
      templateKind?: string;
    } = { source: "template" };
    let stepVisualConfigs: Awaited<
      ReturnType<typeof generateStepVisualConfigsForChapterBatched>
    >["configs"] = [];
    let stepVisualDecisions: StepVisualDecision[] = [];

    const chapterAssets = chapterAssetsForCodegen(opts.assets, wvpChapterId);

    if (opts.narrations.length > 0) {
      const componentName = `Chapter${chapterComponentName(wvpChapterId)}`;
      const resolvedKind =
        opts.forceTemplate ??
        (contentChapter
          ? chapterKindForCraft(
              opts.composition,
              contentChapter.id,
              craft.title,
              opts.narrations,
              plan,
            )
          : (plan.chapterKind as WvpChapterKind | undefined));
      const dataVisualForSkip = isDataVisualChapter({
        chapterTitle: craft.title,
        narrations: opts.narrations,
        screenContents,
      });
      const shouldSkipLlmTsx =
        opts.skipLlmTsx !== false &&
        opts.anchorChapterApproved === true &&
        resolvedKind !== undefined &&
        resolvedKind !== "custom" &&
        !dataVisualForSkip;

      const maxLlmAttempts = 2;
      let validationFeedback = "";
      if (!shouldSkipLlmTsx) for (let attempt = 0; attempt < maxLlmAttempts; attempt++) {
        try {
          const sourceUser = buildChapterSourceUserPrompt({
            wvpChapterId,
            componentName,
            themeId: opts.themeId,
            title: craft.title,
            narrations: opts.narrations,
            articleChapterExcerpt,
            aiPlan: plan,
            screenContents,
            themeTokens,
          });
          const sourcePayload = await generateChapterPlan({
            provider: opts.provider,
            apiKey,
            model: opts.textModel ?? undefined,
            system: CHAPTER_SOURCE_SYSTEM_PROMPT,
            user: validationFeedback
              ? `${sourceUser}\n\n【上次輸出未通過驗證，請修正】\n${validationFeedback}`
              : sourceUser,
          });
          const rawTsx = String(sourcePayload.chapterTsx ?? "").trim();
          const chapterTsx = normalizeChapterTsx(rawTsx, componentName);
          const chapterCss =
            String(sourcePayload.chapterCss ?? "").trim() || "/* CourseFlow LLM */\n";
          const issues = validateChapterTsxIssues(
            chapterTsx,
            opts.narrations.length,
            componentName,
            chapterCss,
            opts.narrations,
            tsxSyntaxChecker,
          );
          if (issues.length === 0) {
            chapterSource = { chapterTsx, chapterCss, source: "llm" };
            break;
          }
          validationFeedback = formatChapterTsxValidationFeedback(issues);
        } catch {
          /* 下一輪重試或 fallback template */
        }
      }

      if (chapterSource.source !== "llm") {
        const folderName = `${String(craft.sort_order).padStart(2, "0")}-${wvpChapterId}`;
        const stepVisuals = (plan.stepVisuals as { step: number; concept?: string }[]) ?? [];
        const beatsFromPlan =
          (plan.stepBeats as { step: number; dominantAction?: string }[]) ?? [];
        const stepBeats =
          beatsFromPlan.length > 0
            ? beatsFromPlan
            : stepVisuals.map((v) => ({
                step: v.step,
                dominantAction: v.concept ?? "",
              }));
        const chapterKind =
          opts.forceTemplate ??
          (contentChapter
            ? chapterKindForCraft(
                opts.composition,
                contentChapter.id,
                craft.title,
                opts.narrations,
                plan,
              )
            : undefined);
        const visualDecisionResult = await generateStepVisualConfigsForChapterBatched({
          provider: opts.provider,
          apiKey,
          narrations: opts.narrations,
          screenContents,
          themeId: opts.themeId,
          courseTopic: craft.title,
          articleExcerpt: articleChapterExcerpt,
        });
        stepVisualConfigs = visualDecisionResult.configs;
        stepVisualDecisions = visualDecisionResult.decisions;
        // 若章節有「整章配圖」，先同步為各步驟本機圖片，讓 resolveStepImageExtMapFromLocalDir 可掃到
        if (opts.userId) {
          await syncChapterIllustrationToStepImages(
            supabase,
            opts.userId,
            projectId,
            craft,
            opts.narrations.length,
          );
        }
        const stepImageExtensions = {
          ...(await resolveStepImageExtMapLocal(projectId, craft)),
          ...(await resolveStepImageExtMapFromLocalDir(projectId, wvpChapterId)),
        };
        const dataVisualChapter = isDataVisualChapter({
          chapterTitle: craft.title,
          narrations: opts.narrations,
          screenContents,
        });
        const preferImageTemplate =
          !dataVisualChapter &&
          (Object.keys(stepImageExtensions).length > 0 ||
            craftHasCompletedIllustrations(craft));
        if (!preferImageTemplate && dataVisualChapter) {
          const heuristic = buildHeuristicStepVisualConfigs(opts.narrations, screenContents);
          if (heuristic.length > 0) {
            stepVisualConfigs = heuristic;
          }
        }
        const effectiveForceTemplate =
          dataVisualChapter &&
          opts.forceTemplate &&
          opts.forceTemplate !== "visual-mix"
            ? undefined
            : opts.forceTemplate;
        const gen = generateChapterSources({
          folderName,
          wvpChapterId,
          title: craft.title,
          narrations: opts.narrations,
          screenContents,
          visualIdeas: (plan.visualIdeas as string[]) ?? undefined,
          stepBeats,
          stepVisuals: stepVisuals as { step: number; vizType?: string; concept?: string }[],
          chapterKind,
          forceTemplate: effectiveForceTemplate,
          assets: chapterAssets.length ? chapterAssets : undefined,
          stepVisualConfigs: preferImageTemplate ? undefined : stepVisualConfigs,
          stepImageExtensions,
          stepMotions: makeDefaultStepMotions(opts.narrations.length, {
            narrations: opts.narrations,
            screenContents,
            chapterKind: chapterKind ?? "list-reveal",
          }),
        });
        chapterSource = {
          chapterTsx: gen.tsx,
          chapterCss: gen.css,
          chapterDslTs: "dslTs" in gen ? gen.dslTs : undefined,
          source: "template",
          templateKind: gen.templateKind,
        };
        if (
          gen.templateKind === "hook" &&
          "narrations" in gen &&
          Array.isArray(gen.narrations) &&
          gen.narrations.length !== opts.narrations.length
        ) {
          opts.narrations = gen.narrations;
        }
      }
    }

    const tsxForCheck = chapterSource.chapterTsx ?? "";
    const cssForCheck = chapterSource.chapterCss ?? "";
    const craftChecklist = runChapterCraftChecklist({
      wvpChapterId,
      tsx: tsxForCheck,
      css: cssForCheck,
      narrations: opts.narrations,
      articleExcerpt: articleChapterExcerpt,
      templateKind:
        (chapterSource as { templateKind?: string }).templateKind ??
        (plan.chapterKind as string),
    });

    // Phase 5 靜態視覺自檢（僅 LLM 生成的 source 才有意義）
    const visualSelfCheck =
      chapterSource.source === "llm"
        ? checkStepsHaveVisuals(tsxForCheck, opts.narrations.length)
        : undefined;

    const { checklistSkipped: _skip, checklistSkippedAt: _skipAt, ...prevCraft } =
      prev as { checklistSkipped?: boolean; checklistSkippedAt?: string };

    await supabase
      .from("chapter_craft")
      .update({
        craft_status: craftChecklist.passed ? "draft" : "checklist-fail",
        checklist_result: {
          ...prevCraft,
          narrations: opts.narrations,
          aiPlan: plan,
          stepVisualConfigs,
            stepVisualDecisions,
          chapterSource,
          craftChecklist,
          ...(visualSelfCheck ? { visualSelfCheck } : {}),
          generatedAt: new Date().toISOString(),
        },
        step_count: opts.narrations.length,
      })
      .eq("id", craft.id);

    return { ok: true, chapterSource: chapterSource.source };
  } catch (e) {
    await supabase
      .from("chapter_craft")
      .update({ craft_status: "checklist-fail" })
      .eq("id", craft.id);
    return { ok: false, chapterSource: "template", error: (e as Error).message };
  }
}

export async function materializeAllChapters(
  supabase: SupabaseClient,
  projectId: string,
  themeId: string,
  opts?: { preserveApprovedAnchorChapter?: boolean },
): Promise<boolean> {
  const composition = await loadCompositionForWvpBuild(supabase, projectId);
  if (!composition) return false;
  const { data: allCrafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  if (!allCrafts?.length) return false;
  const { data: settingsRow } = await supabase
    .from("projects")
    .select("wvp_settings")
    .eq("id", projectId)
    .single();
  const wvpSettings = parseWvpSettings(settingsRow?.wvp_settings);
  const presentationDir = await ensurePresentationScaffolded(projectId, themeId);
  await rebuildRegistryForProject(
    presentationDir,
    allCrafts as CraftRow[],
    composition,
    wvpSettings.assets,
    {
      preserveApprovedAnchorChapter:
        opts?.preserveApprovedAnchorChapter ?? wvpSettings.anchorChapterApproved,
    },
  );
  return true;
}

let materializeChain: Promise<void> = Promise.resolve();

/** 序列化 registry 寫入，避免並行批次競態 */
export async function materializeSingleChapter(
  supabase: SupabaseClient,
  projectId: string,
  themeId: string,
  opts?: { preserveApprovedAnchorChapter?: boolean },
): Promise<boolean> {
  const run = materializeChain.then(() =>
    materializeAllChapters(supabase, projectId, themeId, opts),
  );
  materializeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** 第 1 章套用 list-reveal / flow 骨架（無需 LLM） */
export async function applyChapterTemplate(
  supabase: SupabaseClient,
  projectId: string,
  craft: CraftRow,
  composition: CourseComposition,
  template: WvpChapterKind,
  assets?: WvpAssetRef[],
): Promise<{ ok: boolean; error?: string; templateKind?: string; narrations?: string[] }> {
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  if (!chapter) return { ok: false, error: "找不到對應章節" };

  const narrations = narrationsForChapter(composition, chapter.id);
  if (template === "hook") {
    if (narrations.length < 1) {
      return { ok: false, error: "Hook 章節至少需要 1 段口播" };
    }
  } else if (narrations.length < 2) {
    return { ok: false, error: "至少需要 2 個口播步驟（引子 + 1 項）" };
  }

  const screenContents = screenContentsForChapter(composition, chapter.id);
  const folderName = `${String(craft.sort_order).padStart(2, "0")}-${craft.wvp_chapter_id}`;
  const chapterAssets = chapterAssetsForCodegen(assets, craft.wvp_chapter_id);
  const gen = generateChapterSources({
    folderName,
    wvpChapterId: craft.wvp_chapter_id,
    title: craft.title,
    narrations,
    screenContents,
    forceTemplate: template,
    assets: chapterAssets.length ? chapterAssets : undefined,
    stepMotions: makeDefaultStepMotions(narrations.length, {
      narrations,
      screenContents,
      chapterKind: template,
    }),
  });
  const outNarrations =
    "narrations" in gen && Array.isArray(gen.narrations) ? gen.narrations : narrations;

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? craft.checklist_result
      : {};

  const craftChecklist = runChapterCraftChecklist({
    wvpChapterId: craft.wvp_chapter_id,
    tsx: gen.tsx,
    css: gen.css,
    narrations: outNarrations,
    templateKind: gen.templateKind,
  });

  const { checklistSkipped: _s, checklistSkippedAt: _a, ...prevAnchor } = prev as {
    checklistSkipped?: boolean;
    checklistSkippedAt?: string;
  };

  await supabase
    .from("chapter_craft")
    .update({
      craft_status: craftChecklist.passed ? "anchor-review" : "checklist-fail",
      step_count: outNarrations.length,
      checklist_result: {
        ...prevAnchor,
        narrations: outNarrations,
        chapterSource: {
          chapterTsx: gen.tsx,
          chapterCss: gen.css,
          chapterDslTs: "dslTs" in gen ? gen.dslTs : undefined,
          source: "template",
          templateKind: gen.templateKind,
        },
        appliedScreenContents: screenContents,
        craftChecklist,
        appliedTemplate: template,
      },
    })
    .eq("id", craft.id);

  return { ok: true, templateKind: gen.templateKind, narrations: outNarrations };
}

function craftHasCompletedIllustrations(craft: CraftRow): boolean {
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

/** 依 Checkpoint 素材自動選模板：有圖用 Hook，否則清單揭示 */
export function pickAnchorTrialTemplate(
  assets: WvpAssetRef[] | undefined,
  wvpChapterId: string,
): WvpChapterKind {
  return chapterAssetsForCodegen(assets, wvpChapterId).length > 0
    ? "hook"
    : "list-reveal";
}

/** 第 1 章試執行：匯入口播 → 套用模板 → 打包僅含第 1 章的預覽（螢幕文字與文稿內容一致） */
export async function runAnchorChapterTrial(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts: {
    provider: LlmProviderId;
    encryptedKey: string;
    textModel?: string | null;
    themeId: string;
    onStage?: (stage: string) => Promise<void> | void;
  },
): Promise<{
  ok: boolean;
  wvpChapterId: string;
  templateKind: string;
  chapterSource?: "llm" | "template";
  previewUrl: string;
  illustrationSyncWarning?: string;
  error?: string;
}> {
  const startedAt = Date.now();
  const logStage = (stage: string) => {
    const elapsedMs = Date.now() - startedAt;
    console.info(`[wvp-trial] ${stage} (+${elapsedMs}ms)`, { projectId, userId });
  };

  const emitStage = async (stage: string) => {
    logStage(stage);
    await opts.onStage?.(stage);
  };

  await emitStage("start");
  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const first = (crafts as CraftRow[] | undefined)?.[0];
  if (!first) {
    return {
      ok: false,
      wvpChapterId: "",
      templateKind: "",
      previewUrl: "",
      error: "請先建立章節清單",
    };
  }

  const composition = await loadCompositionForWvpBuild(supabase, projectId);
  if (!composition) {
    return {
      ok: false,
      wvpChapterId: first.wvp_chapter_id,
      templateKind: "",
      previewUrl: "",
      error: "無法載入專案內容",
    };
  }
  await emitStage("composition-loaded");

  const { data: project } = await supabase
    .from("projects")
    .select("wvp_settings")
    .eq("id", projectId)
    .single();
  const wvpSettings = parseWvpSettings(project?.wvp_settings);
  const template = pickAnchorTrialTemplate(wvpSettings.assets, first.wvp_chapter_id);

  if (wvpSettings.anchorChapterApproved || wvpSettings.anchorChapterTrialCompleted) {
    const resetSettings = {
      ...wvpSettings,
      anchorChapterApproved: false,
      anchorProfile: undefined,
    };
    await supabase
      .from("projects")
      .update({ wvp_settings: resetSettings })
      .eq("id", projectId);
    if (first.craft_status === "approved") {
      await supabase
        .from("chapter_craft")
        .update({ craft_status: "draft" })
        .eq("id", first.id);
    }
  }

  const sync = await syncChapterNarrations(supabase, projectId, first, composition);
  await emitStage("narration-synced");
  if (sync.error) {
    return {
      ok: false,
      wvpChapterId: first.wvp_chapter_id,
      templateKind: template,
      previewUrl: "",
      error: sync.error,
    };
  }

  const apply = await applyChapterTemplate(
    supabase,
    projectId,
    first,
    composition,
    template,
    wvpSettings.assets,
  );
  await emitStage("template-applied");
  if (!apply.ok) {
    return {
      ok: false,
      wvpChapterId: first.wvp_chapter_id,
      templateKind: template,
      previewUrl: "",
      error: apply.error ?? "套用模板失敗",
    };
  }

  const chapterSource: "llm" | "template" = "template";
  await emitStage("chapter-craft-skipped-trial-template");
  console.info(
    "[wvp-trial] skip generateChapterCraft: trial uses applyChapterTemplate for screen fidelity",
    { projectId, userId, template },
  );

  const { buildAnchorChapterPreview } = await import("@/lib/wvp-presentation-sync");
  const build = await buildAnchorChapterPreview(supabase, projectId, userId, {
    themeId: opts.themeId,
    onStage: emitStage,
  });
  await emitStage("preview-built");

  const previewUrl = `/projects/${projectId}/wvp-play?anchor=1&start=1`;
  return {
    ok: true,
    wvpChapterId: build.wvpChapterId,
    templateKind: apply.templateKind ?? template,
    chapterSource,
    previewUrl,
    illustrationSyncWarning: build.illustrationSyncWarning,
  };
}

export type BatchChapterResult = {
  wvpChapterId: string;
  title: string;
  synced: boolean;
  generated: boolean;
  chapterSource?: "llm" | "template";
  error?: string;
};

function updateChapterProgress(
  progress: WvpBatchCraftProgress,
  wvpChapterId: string,
  patch: Partial<WvpBatchCraftProgress["chapters"][number]>,
): void {
  const idx = progress.chapters.findIndex((ch) => ch.wvpChapterId === wvpChapterId);
  if (idx < 0) return;
  progress.chapters[idx] = { ...progress.chapters[idx]!, ...patch };
}

async function processBatchChapter(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  row: CraftRow,
  ctx: {
    composition: CourseComposition;
    article: string;
    themeId: string;
    wvpSettings: ReturnType<typeof parseWvpSettings>;
    anchorProfile: WvpAnchorProfile | undefined;
    firstSort: number;
    opts: {
      provider: LlmProviderId;
      encryptedKey: string;
      textModel?: string | null;
      onlyMissing?: boolean;
      skipGenerate?: boolean;
      skipMaterialize?: boolean;
      skipLlmTsx?: boolean;
      resumeFromSortOrder?: number;
      signal?: AbortSignal;
      isCancelled?: () => Promise<boolean>;
    };
    progress: WvpBatchCraftProgress;
    emitProgress: () => Promise<void>;
  },
): Promise<BatchChapterResult> {
  const entry: BatchChapterResult = {
    wvpChapterId: row.wvp_chapter_id,
    title: row.title,
    synced: false,
    generated: false,
  };

  const chapterIdx = ctx.progress.chapters.findIndex((ch) => ch.wvpChapterId === row.wvp_chapter_id);
  if (chapterIdx >= 0) {
    ctx.progress.currentChapterIndex = chapterIdx;
    ctx.progress.currentWvpChapterId = row.wvp_chapter_id;
    ctx.progress.currentTitle = row.title;
  }

  if (ctx.opts.signal?.aborted || (await ctx.opts.isCancelled?.())) {
    updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "skipped" });
    await ctx.emitProgress();
    return entry;
  }

  if (
    ctx.opts.resumeFromSortOrder !== undefined &&
    row.sort_order < ctx.opts.resumeFromSortOrder
  ) {
    updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "skipped" });
    await ctx.emitProgress();
    return entry;
  }

  if (row.sort_order !== ctx.firstSort && !ctx.wvpSettings.anchorChapterApproved) {
    entry.error = "請先在 Studio 驗收第 1 章風格錨點，再批量處理其餘章節";
    updateChapterProgress(ctx.progress, row.wvp_chapter_id, {
      status: "failed",
      error: entry.error,
    });
    await ctx.emitProgress();
    return entry;
  }

  const chapterStartedAt = Date.now();
  console.log(
    `[wvp-batch-chapter] start project=${projectId} chapter=${row.wvp_chapter_id} sort=${row.sort_order} title="${row.title}"`,
  );
  ctx.progress.phase = "sync";
  updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "running" });
  await ctx.emitProgress();

  const sync = await syncChapterNarrations(supabase, projectId, row, ctx.composition);
  if (sync.error) {
    entry.error = sync.error;
    updateChapterProgress(ctx.progress, row.wvp_chapter_id, {
      status: "failed",
      error: entry.error,
    });
    ctx.progress.chapterDurationsMs.push(Date.now() - chapterStartedAt);
    await ctx.emitProgress();
    return entry;
  }
  entry.synced = true;
  updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "synced" });
  await ctx.emitProgress();

  const prevCheck = row.checklist_result as { chapterSource?: unknown } | null | undefined;
  const hasSource = !!prevCheck?.chapterSource;
  if (ctx.opts.skipGenerate || (ctx.opts.onlyMissing && hasSource)) {
    if (!ctx.opts.skipMaterialize && entry.synced) {
      ctx.progress.phase = "materialize";
      await ctx.emitProgress();
      await materializeSingleChapter(supabase, projectId, ctx.themeId, {
        preserveApprovedAnchorChapter: ctx.wvpSettings.anchorChapterApproved,
      });
      updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "materialized" });
    }
    ctx.progress.chapterDurationsMs.push(Date.now() - chapterStartedAt);
    await ctx.emitProgress();
    return entry;
  }

  ctx.progress.phase = "generate";
  updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "running" });
  await ctx.emitProgress();

  const gen = await generateChapterCraft(supabase, projectId, row, {
    provider: ctx.opts.provider,
    encryptedKey: ctx.opts.encryptedKey,
    textModel: ctx.opts.textModel,
    composition: ctx.composition,
    article: ctx.article,
    themeId: ctx.themeId,
    narrations: sync.narrations,
    anchorProfile: row.sort_order !== ctx.firstSort ? ctx.anchorProfile : undefined,
    assets: ctx.wvpSettings.assets,
    userId,
    skipLlmTsx: ctx.opts.skipLlmTsx,
    anchorChapterApproved: ctx.wvpSettings.anchorChapterApproved,
  });
  entry.generated = gen.ok;
  entry.chapterSource = gen.chapterSource;
  if (gen.error) entry.error = gen.error;

  if (gen.ok) {
    updateChapterProgress(ctx.progress, row.wvp_chapter_id, {
      status: "generated",
      chapterSource: gen.chapterSource,
    });
    await ctx.emitProgress();

    if (!ctx.opts.skipMaterialize) {
      ctx.progress.phase = "materialize";
      await ctx.emitProgress();
      await materializeSingleChapter(supabase, projectId, ctx.themeId, {
        preserveApprovedAnchorChapter: ctx.wvpSettings.anchorChapterApproved,
      });
      updateChapterProgress(ctx.progress, row.wvp_chapter_id, { status: "materialized" });
    }
  } else {
    updateChapterProgress(ctx.progress, row.wvp_chapter_id, {
      status: "failed",
      error: gen.error,
    });
  }

  ctx.progress.chapterDurationsMs.push(Date.now() - chapterStartedAt);
  await ctx.emitProgress();
  const elapsedSec = Math.round((Date.now() - chapterStartedAt) / 1000);
  const finalStatus =
    ctx.progress.chapters.find((ch) => ch.wvpChapterId === row.wvp_chapter_id)?.status ?? "unknown";
  console.log(
    `[wvp-batch-chapter] done project=${projectId} chapter=${row.wvp_chapter_id} status=${finalStatus} synced=${entry.synced} generated=${entry.generated} elapsed=${elapsedSec}s${entry.error ? ` error="${entry.error}"` : ""}`,
  );
  return entry;
}

export async function batchCraftAllChapters(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts: {
    provider: LlmProviderId;
    encryptedKey: string;
    textModel?: string | null;
    onlyMissing?: boolean;
    skipGenerate?: boolean;
    skipMaterialize?: boolean;
    skipLlmTsx?: boolean;
    resumeFromSortOrder?: number;
    signal?: AbortSignal;
    isCancelled?: () => Promise<boolean>;
    onProgress?: (progress: WvpBatchCraftProgress) => void | Promise<void>;
  },
): Promise<{ results: BatchChapterResult[]; materialized: boolean; progress: WvpBatchCraftProgress }> {
  const { data: project } = await supabase
    .from("projects")
    .select("article, theme_id")
    .eq("id", projectId)
    .single();

  const composition = await loadProjectComposition(supabase, projectId);
  if (!composition) throw new Error("無法載入專案內容");

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (!crafts?.length) throw new Error("請先建立章節清單");

  const article = (project?.article as { rawText?: string })?.rawText?.slice(0, 8000) ?? "";
  const themeId = project?.theme_id ?? "warm-keynote";

  const { data: settingsRow } = await supabase
    .from("projects")
    .select("wvp_settings")
    .eq("id", projectId)
    .single();
  const wvpSettings = parseWvpSettings(settingsRow?.wvp_settings);
  const anchorProfile = wvpSettings.anchorProfile;
  const craftRows = crafts as CraftRow[];
  const firstSort = craftRows[0]?.sort_order ?? 0;

  const progress = createInitialBatchProgress(
    craftRows.map((row) => ({
      wvpChapterId: row.wvp_chapter_id,
      title: row.title,
      sortOrder: row.sort_order,
    })),
  );

  let progressChain: Promise<void> = Promise.resolve();
  const emitProgress = async (): Promise<void> => {
    progressChain = progressChain.then(async () => {
      await opts.onProgress?.({ ...progress, chapters: [...progress.chapters] });
    });
    await progressChain;
  };
  await emitProgress();

  const ctx = {
    composition,
    article,
    themeId,
    wvpSettings,
    anchorProfile,
    firstSort,
    opts: {
      ...opts,
      skipLlmTsx: opts.skipLlmTsx ?? true,
    },
    progress,
    emitProgress,
  };

  const firstChapter = craftRows.find((row) => row.sort_order === firstSort);
  const restChapters = craftRows.filter((row) => row.sort_order !== firstSort);
  const concurrency = resolveBatchConcurrency();
  console.log(
    `[wvp-batch-chapter] batch start project=${projectId} total=${craftRows.length} concurrency=${concurrency} onlyMissing=${Boolean(opts.onlyMissing)} skipMaterialize=${Boolean(opts.skipMaterialize)}`,
  );

  const firstResults: BatchChapterResult[] = [];
  if (firstChapter) {
    firstResults.push(await processBatchChapter(supabase, projectId, userId, firstChapter, ctx));
  }

  const restResults = await runPool(restChapters, concurrency, (row) =>
    processBatchChapter(supabase, projectId, userId, row, ctx),
  );

  const results = [...firstResults, ...restResults].sort((a, b) => {
    const aSort = craftRows.find((r) => r.wvp_chapter_id === a.wvpChapterId)?.sort_order ?? 0;
    const bSort = craftRows.find((r) => r.wvp_chapter_id === b.wvpChapterId)?.sort_order ?? 0;
    return aSort - bSort;
  });

  progress.phase = "done";
  progress.currentChapterIndex = progress.totalChapters;
  await emitProgress();

  const materialized = !opts.skipMaterialize && results.some((r) => r.synced || r.generated);
  return { results, materialized, progress };
}

export type BatchBuildResult = {
  built: boolean;
  chapterCount: number;
  chaptersVisualUpgraded?: string[];
  storageUploaded?: boolean;
  storageUploadWarning?: string;
  audioSyncWarning?: string;
  illustrationSyncWarning?: string;
};

/** 全課批次生成 + 打包預覽（含音訊同步與 Vite build） */
export async function batchCraftAllChaptersAndBuild(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts: {
    provider: LlmProviderId;
    encryptedKey: string;
    textModel?: string | null;
    onlyMissing?: boolean;
    skipLlmTsx?: boolean;
    resumeFromSortOrder?: number;
    signal?: AbortSignal;
    isCancelled?: () => Promise<boolean>;
    onProgress?: (progress: WvpBatchCraftProgress) => void | Promise<void>;
  },
): Promise<{
  results: BatchChapterResult[];
  materialized: boolean;
  build: BatchBuildResult;
}> {
  const { results } = await batchCraftAllChapters(supabase, projectId, userId, {
    ...opts,
    skipMaterialize: true,
  });

  const failed = results.filter((r) => r.error);
  if (failed.length === results.length) {
    throw new Error(failed[0]?.error ?? "所有章節處理失敗");
  }

  const sync = await syncFullWvpProject(supabase, projectId, userId, {
    build: true,
    previewBase: wvpEmbedBasePath(projectId),
  });

  return {
    results,
    materialized: true,
    build: {
      built: sync.built,
      chapterCount: sync.chapterCount,
      chaptersVisualUpgraded: sync.chaptersVisualUpgraded,
      storageUploaded: sync.storageUploaded,
      storageUploadWarning: sync.storageUploadWarning,
      audioSyncWarning: sync.audioSyncWarning,
      illustrationSyncWarning: sync.illustrationSyncWarning,
    },
  };
}
