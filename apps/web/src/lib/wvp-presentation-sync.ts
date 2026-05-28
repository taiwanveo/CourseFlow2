import type { SupabaseClient } from "@supabase/supabase-js";
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
import { syncCheckpointAssetsToPresentation } from "@/lib/wvp-checkpoint-assets-sync";
import { uploadWvpDistToStorage } from "@/lib/wvp-dist-storage";
import { shouldAsyncWvpBuild } from "@/lib/wvp-build-async";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import { chapterKindForCraft, screenContentsForChapter } from "@/lib/wvp-chapter-meta";
import { loadProjectComposition } from "@/lib/project-composition";
import { chapterAssetsForCodegen } from "@/lib/wvp-assets";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { parseWvpSettings, type WvpAssetRef } from "@/lib/wvp-settings";
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
  const chapter = composition.chapters.find((c) => c.title === craft.title);
  const narrations =
    craft.checklist_result?.narrations ??
    (chapter ? narrationsForChapter(composition, chapter.id) : []);
  const aiPlan = craft.checklist_result?.aiPlan;
  const rawSource = craft.checklist_result?.chapterSource;
  const folderName = folderFromPresentationPath(
    craft.presentation_path ?? null,
    craft.sort_order,
    craft.wvp_chapter_id,
  );
  const componentName = `Chapter${chapterComponentName(craft.wvp_chapter_id)}`;

  const assets = chapterAssetsForCodegen(projectAssets, craft.wvp_chapter_id);
  const llmTsx = rawSource?.chapterTsx?.trim() ?? "";
  if (
    assets.length === 0 &&
    llmTsx &&
    validateChapterTsx(
      llmTsx,
      narrations.length,
      componentName,
      rawSource?.chapterCss ?? "",
      narrations,
    )
  ) {
    await writeChapterSourcesRaw(presentationDir, {
      folderName,
      componentName,
      narrations,
      chapterTsx: llmTsx,
      chapterCss: rawSource?.chapterCss?.trim() || "/* CourseFlow LLM chapter */\n",
    });
  } else {
    const stepVisualConfigs = craft.checklist_result?.stepVisualConfigs;
    const written = await writeChapterToPresentation(presentationDir, {
      folderName,
      wvpChapterId: craft.wvp_chapter_id,
      title: craft.title,
      narrations,
      visualIdeas: aiPlan?.visualIdeas,
      stepBeats: aiPlan?.stepBeats,
      stepVisuals: (aiPlan?.stepVisuals as { step: number; vizType?: string }[]) ?? undefined,
      screenContents: chapter ? screenContentsForChapter(composition, chapter.id) : [],
      chapterKind: chapter
        ? chapterKindForCraft(composition, chapter.id, craft.title, narrations, aiPlan)
        : undefined,
      assets: assets.length ? assets : undefined,
      stepVisualConfigs,
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
      composition.chapters.some((c) => c.title === craft.title);
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

/** 完整打包預設略過 AI 配圖（在 Craft 完成）；設 COURSEFLOW_PACK_ILLUSTRATIONS=1 可強制同步 */
function shouldSyncIllustrationsOnFullPack(): boolean {
  return process.env.COURSEFLOW_PACK_ILLUSTRATIONS === "1";
}

function requiresDistInStorage(): boolean {
  return (
    !!process.env.COURSEFLOW_PRESENTATION_ROOT?.trim() ||
    process.env.RENDER === "true" ||
    shouldAsyncWvpBuild()
  );
}

/** 第 1 章試跑預覽：僅註冊第 1 章、略過語音門檻、打包 dist */
export async function buildAnchorChapterPreview(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts?: { themeId?: string },
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
  const themeId =
    opts?.themeId ?? wvpSettings.themeId ?? project.theme_id ?? "midnight-press";

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const first = (crafts ?? [])[0] as CraftRow | undefined;
  if (!first) throw new Error("請先建立章節清單");

  const composition = await loadProjectComposition(supabase, projectId);
  if (!composition) throw new Error("無法載入專案內容");

  const presentationDir = await ensurePresentationScaffolded(projectId, themeId);
  const entries = await rebuildRegistryForProject(
    presentationDir,
    [first],
    composition,
    wvpSettings.assets,
  );
  if (entries.length === 0) {
    throw new Error("第 1 章尚無口播步驟，請先在「文稿內容」完成大綱");
  }

  await syncCheckpointAssetsToPresentation(projectId, wvpSettings.assets);

  const illustrationSyncWarning =
    "試跑僅打包畫面程式；配圖請在「AI 配圖工作室」確認提示詞後生圖。";

  const base = `/projects/${projectId}/wvp-embed/`;
  await buildProjectPresentation(projectId, base);

  const nextSettings = {
    ...wvpSettings,
    themeId,
    anchorChapterTrialCompleted: true,
  };
  await supabase
    .from("projects")
    .update({
      wvp_settings: nextSettings,
      presentation_revision: `anchor-trial-${Date.now()}`,
    })
    .eq("id", projectId);

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

  const themeId =
    opts?.themeId ??
    (project.wvp_settings as { themeId?: string })?.themeId ??
    project.theme_id ??
    "midnight-press";

  const presentationDir = await ensurePresentationScaffolded(projectId, themeId);

  const composition = await loadProjectComposition(supabase, projectId);
  if (!composition) throw new Error("無法載入專案內容");

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  const wvpSettings = parseWvpSettings(project.wvp_settings);
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

    if (shouldSyncIllustrationsOnFullPack()) {
      const styleFragment = resolveImageStyleFragment(wvpSettings.imageStyle);
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
        { skipVisualDirector: true, reuseExistingFiles: true },
      );
      if (illus.skippedNoKey && illus.attempted > 0) {
        illustrationSyncWarning =
          "清單章節需 AI 配圖：請在設定頁填寫 OpenAI 或 OpenRouter API Key 後重新建置。";
      } else if (illus.attempted > 0 && illus.written === 0) {
        illustrationSyncWarning = "AI 配圖未成功寫入（可檢查 API 額度或稍後重試建置）。";
      } else if (illus.written > 0 && illus.written < illus.attempted) {
        illustrationSyncWarning = `已生成 ${illus.written}/${illus.attempted} 張配圖，其餘卡片僅顯示標題。`;
      }
    } else {
      illustrationSyncWarning =
        "快速打包已略過 AI 配圖同步（請在「視覺動效」完成配圖；需強制同步請設 COURSEFLOW_PACK_ILLUSTRATIONS=1）。";
    }

    const base = opts.previewBase ?? `/projects/${projectId}/wvp-embed/`;
    const result = await buildProjectPresentation(projectId, base);
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
