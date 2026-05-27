import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { buildChapterCraftPlan } from "@/lib/wvp-chapters";
import { parseWvpSettings, type WvpSettings } from "@/lib/wvp-settings";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { hasBuiltPresentation } from "@/lib/wvp-workdir";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("phase_locks, wvp_phase_locks, wvp_settings, theme_id, presentation_revision")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .order("sort_order");

  const composition = await loadProjectComposition(supabase, id);
  const plan = composition ? buildChapterCraftPlan(composition) : [];

  const previewBuilt = await hasBuiltPresentation(id);

  const chapterOptions =
    (crafts ?? []).length > 0
      ? (crafts ?? []).map((c) => ({
          wvpChapterId: c.wvp_chapter_id,
          title: c.title,
          source: "craft" as const,
        }))
      : plan.map((p) => ({
          wvpChapterId: p.wvpChapterId,
          title: p.title,
          source: "composition" as const,
        }));

  return NextResponse.json({
    wvpPhaseLocks: resolveWvpPhaseLocks(project),
    wvpSettings: parseWvpSettings(project.wvp_settings),
    themeId: project.theme_id,
    presentationRevision: project.presentation_revision,
    previewBuilt,
    chapters: crafts ?? [],
    plan,
    chapterOptions,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json()) as { wvpSettings?: Partial<WvpSettings>; themeId?: string | null };
  const { data: project } = await supabase
    .from("projects")
    .select("wvp_settings, theme_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const prev = parseWvpSettings(project.wvp_settings);
  const nextSettings = { ...prev, ...body.wvpSettings };
  const patch: Record<string, unknown> = { wvp_settings: nextSettings };
  if (body.themeId !== undefined) {
    patch.theme_id = body.themeId;
    nextSettings.themeId = body.themeId;
  }

  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, wvpSettings: nextSettings });
}
