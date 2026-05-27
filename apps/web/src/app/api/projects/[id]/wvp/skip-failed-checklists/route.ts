import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateChapterExportIssue,
  isChecklistSkipped,
  normalizeChecklistResult,
} from "@/lib/wvp-export-readiness";

/** 一次略過專案內所有未通過視覺自檢的章節 */
export async function POST(
  _req: Request,
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
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const { data: crafts, error } = await supabase
    .from("chapter_craft")
    .select("id, wvp_chapter_id, title, craft_status, checklist_result")
    .eq("project_id", id)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const skipped: string[] = [];
  const now = new Date().toISOString();

  for (const craft of crafts ?? []) {
    const issue = evaluateChapterExportIssue({
      wvp_chapter_id: craft.wvp_chapter_id,
      title: craft.title,
      craft_status: craft.craft_status,
      checklist_result: craft.checklist_result,
    });
    if (issue.checklistOk || issue.checklistSkipped) continue;

    const prev = normalizeChecklistResult(craft.checklist_result) ?? {};
    const { error: updateError } = await supabase
      .from("chapter_craft")
      .update({
        checklist_result: {
          ...prev,
          checklistSkipped: true,
          checklistSkippedAt: now,
        },
      })
      .eq("id", craft.id);

    if (updateError) {
      return NextResponse.json(
        { error: `略過「${craft.title}」失敗：${updateError.message}` },
        { status: 500 },
      );
    }
    skipped.push(craft.title);
  }

  return NextResponse.json({ ok: true, skippedCount: skipped.length, skipped });
}
