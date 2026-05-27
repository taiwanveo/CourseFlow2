import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { buildChapterCraftPlan } from "@/lib/wvp-chapters";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { parseWvpSettings } from "@/lib/wvp-settings";
import { ensurePresentationScaffolded } from "@/lib/wvp-presentation-sync";

export async function POST(
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
    .select("wvp_phase_locks, phase_locks, wvp_settings, theme_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const composition = await loadProjectComposition(supabase, id);
  if (!composition?.chapters.length) {
    return NextResponse.json({ error: "請先完成文稿大綱" }, { status: 400 });
  }

  const plan = buildChapterCraftPlan(composition);
  const settings = parseWvpSettings(project.wvp_settings);
  const themeId = settings.themeId ?? project.theme_id;

  await supabase.from("chapter_craft").delete().eq("project_id", id);

  const rows = plan.map((p) => ({
    project_id: id,
    wvp_chapter_id: p.wvpChapterId,
    title: p.title,
    craft_status: "pending",
    step_count: p.stepCount,
    sort_order: p.sortOrder,
    presentation_path: `presentation/src/chapters/${p.sortOrder.toString().padStart(2, "0")}-${p.wvpChapterId}`,
  }));

  const { error: insErr } = await supabase.from("chapter_craft").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try {
    await ensurePresentationScaffolded(id, themeId ?? "midnight-press");
  } catch (e) {
    return NextResponse.json(
      { error: `presentation 腳手架失敗：${(e as Error).message}` },
      { status: 500 },
    );
  }

  await supabase
    .from("projects")
    .update({
      presentation_revision: `scaffold-${Date.now()}`,
      theme_id: themeId,
    })
    .eq("id", id);

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .order("sort_order");

  return NextResponse.json({
    ok: true,
    chapterCount: rows.length,
    chapters: crafts,
  });
}
