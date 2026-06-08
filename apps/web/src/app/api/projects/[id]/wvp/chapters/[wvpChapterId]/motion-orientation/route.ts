import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CHAPTER_MOTION_ORIENTATION_LABELS,
  type ChapterMotionOrientation,
} from "@courseflow/explain-animation";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { createClient } from "@/lib/supabase/server";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { bumpMotionPreferenceRevision } from "@/lib/wvp-craft-illustrations";

const ALLOWED: ChapterMotionOrientation[] = ["auto", "data", "flow", "contrast", "minimal"];

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
    orientation?: ChapterMotionOrientation;
  };
  if (!body.orientation || !ALLOWED.includes(body.orientation)) {
    return NextResponse.json({ error: "無效的動效取向" }, { status: 400 });
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("checklist_result")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return NextResponse.json({ error: "找不到章節" }, { status: 404 });

  const prev =
    craft.checklist_result && typeof craft.checklist_result === "object"
      ? (craft.checklist_result as Record<string, unknown>)
      : {};
  const merged = bumpMotionPreferenceRevision({
    ...prev,
    motionOrientation: body.orientation,
  });

  const { error } = await supabase
    .from("chapter_craft")
    .update({ checklist_result: merged })
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    orientation: body.orientation,
    label: CHAPTER_MOTION_ORIENTATION_LABELS[body.orientation],
  });
}
