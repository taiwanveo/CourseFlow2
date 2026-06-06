import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertWvpPhaseEditable, type WvpChapterKind } from "@courseflow/core";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition, saveComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { resolveCompositionChapterForCraft } from "@/lib/wvp-chapter-meta";
import { resolveChapterTemplateSelectState } from "@/lib/wvp-chapter-template";

const ALLOWED: WvpChapterKind[] = ["list-reveal", "flow", "hook", "magazine"];

export async function PATCH(
  req: NextRequest,
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

  try {
    assertWvpPhaseEditable(resolveWvpPhaseLocks(project), "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    chapterKind?: WvpChapterKind | null;
    auto?: boolean;
  };

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("title, wvp_chapter_id, sort_order")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return NextResponse.json({ error: "找不到章節" }, { status: 404 });

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });

  const contentChapter = resolveCompositionChapterForCraft(composition, craft);
  if (!contentChapter) {
    return NextResponse.json({ error: "找不到對應文稿章節" }, { status: 400 });
  }

  let nextKind: WvpChapterKind | undefined;
  if (body.auto === true || body.chapterKind === null) {
    nextKind = undefined;
  } else if (body.chapterKind) {
    if (!ALLOWED.includes(body.chapterKind)) {
      return NextResponse.json({ error: "無效的版型" }, { status: 400 });
    }
    nextKind = body.chapterKind;
  } else {
    return NextResponse.json({ error: "請提供 chapterKind 或 auto" }, { status: 400 });
  }

  const nextComposition = {
    ...composition,
    chapters: composition.chapters.map((ch) =>
      ch.id === contentChapter.id ? { ...ch, chapterKind: nextKind } : ch,
    ),
  };
  await saveComposition(supabase, id, nextComposition);

  const state = resolveChapterTemplateSelectState(nextComposition, craft);
  return NextResponse.json({
    ok: true,
    chapterKind: state.storedKind ?? null,
    inferredKind: state.inferredKind,
    inferredDisplayKind: state.inferredDisplayKind,
    selectValue: state.selectValue,
    isAuto: state.isAuto,
  });
}
