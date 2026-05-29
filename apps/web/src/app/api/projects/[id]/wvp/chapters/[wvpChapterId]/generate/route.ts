import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveLlmProvider, resolveEffectiveTextModel } from "@/lib/llm-provider";
import type { LlmProviderId } from "@courseflow/llm";
import { loadProjectComposition } from "@/lib/project-composition";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import {
  generateChapterCraft,
  materializeAllChapters,
  type CraftRow,
} from "@/lib/wvp-chapter-craft";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { parseWvpSettings } from "@/lib/wvp-settings";

/** M3-3：章節 AI — 視覺計畫 JSON + 模板／LLM Chapter.tsx（含 Checkpoint 素材） */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { provider?: LlmProviderId };
  const resolved = await resolveLlmProvider(supabase, user.id, body.provider);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return NextResponse.json({ error: "章節不存在" }, { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("article, theme_id, wvp_settings")
    .eq("id", id)
    .single();

  const article = (project?.article as { rawText?: string })?.rawText?.slice(0, 8000) ?? "";
  const themeId = project?.theme_id ?? "warm-keynote";
  const styleGuard = assertProjectImageStyleConfigured(project?.wvp_settings);
  if (!styleGuard.ok) {
    return NextResponse.json({ error: styleGuard.error }, { status: styleGuard.status });
  }
  const wvpSettings = styleGuard.settings;

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) {
    return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
  }

  const contentChapter = composition.chapters.find((c) => c.title === craft.title);
  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const narrations =
    (prev.narrations as string[] | undefined)?.filter(Boolean) ??
    (contentChapter ? narrationsForChapter(composition, contentChapter.id) : []);

  const { data: firstCraft } = await supabase
    .from("chapter_craft")
    .select("sort_order, wvp_chapter_id")
    .eq("project_id", id)
    .order("sort_order")
    .limit(1)
    .maybeSingle();

  const gen = await generateChapterCraft(supabase, id, craft as CraftRow, {
    provider: resolved.provider,
    encryptedKey: resolved.encryptedKey,
    textModel: resolveEffectiveTextModel(resolved.provider, resolved.textModel, resolved.defaultModel),
    composition,
    article,
    themeId,
    narrations,
    anchorProfile:
      firstCraft && craft.sort_order !== firstCraft.sort_order
        ? wvpSettings.anchorProfile
        : undefined,
    assets: wvpSettings.assets,
  });

  let materialized = false;
  if (gen.ok) {
    try {
      materialized = await materializeAllChapters(supabase, id, themeId);
    } catch {
      materialized = false;
    }
  }

  const { data: updated } = await supabase
    .from("chapter_craft")
    .select("step_count, checklist_result")
    .eq("id", craft.id)
    .single();

  return NextResponse.json({
    ok: gen.ok,
    chapterSource: gen.chapterSource,
    materialized,
    stepCount: updated?.step_count ?? narrations.length,
    error: gen.error,
    checklist: updated?.checklist_result,
  });
}
