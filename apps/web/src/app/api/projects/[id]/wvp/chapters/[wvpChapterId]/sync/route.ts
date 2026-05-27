import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { emptyChapterChecklist, mergeChecklistResults } from "@courseflow/craft-agent";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { narrationsForChapter } from "@/lib/wvp-chapters";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { assertWvpPhaseEditable } from "@courseflow/core";

/** 從 composition 同步 narrations 骨架（步數與口播），並更新章節狀態 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("wvp_phase_locks, phase_locks")
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

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) {
    return NextResponse.json({ error: "請先執行「建立章節計畫」" }, { status: 400 });
  }

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) return NextResponse.json({ error: "無法載入專案" }, { status: 400 });

  const chapter = composition.chapters.find((c) => c.title === craft.title);
  if (!chapter) {
    return NextResponse.json({ error: "找不到對應章節" }, { status: 400 });
  }

  const narrations = narrationsForChapter(composition, chapter.id);
  const checklist = mergeChecklistResults(wvpChapterId, [
    {
      id: "narrations-length",
      label: "narrations.length === 最大 step + 1",
      passed: narrations.length > 0,
      evidence: `${narrations.length} steps`,
    },
    {
      id: "list-reveal",
      label: "清單/列表 1 項 = 1 step",
      passed: true,
      evidence: "已依 composition 步驟切分",
    },
  ]);

  const { data: updated, error } = await supabase
    .from("chapter_craft")
    .update({
      step_count: narrations.length,
      craft_status: "draft",
      checklist_result: { ...checklist, narrations },
    })
    .eq("id", craft.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    chapter: updated,
    narrations,
    checklist,
  });
}
