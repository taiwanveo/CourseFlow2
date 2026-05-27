import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isChecklistSkipped,
  normalizeChecklistResult,
} from "@/lib/wvp-export-readiness";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId: rawChapterId } = await params;
  const wvpChapterId = decodeURIComponent(rawChapterId);

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

  const { data: craft, error } = await supabase
    .from("chapter_craft")
    .select("id, title, craft_status, checklist_result")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!craft) {
    return NextResponse.json({ error: "找不到章節" }, { status: 404 });
  }

  const prev = normalizeChecklistResult(craft.checklist_result) ?? {};

  if (isChecklistSkipped(prev)) {
    return NextResponse.json({ ok: true, title: craft.title, alreadySkipped: true });
  }

  const { data: updated, error: updateError } = await supabase
    .from("chapter_craft")
    .update({
      checklist_result: {
        ...prev,
        checklistSkipped: true,
        checklistSkippedAt: new Date().toISOString(),
      },
    })
    .eq("id", craft.id)
    .select("checklist_result")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!isChecklistSkipped(updated?.checklist_result)) {
    return NextResponse.json(
      { error: "略過狀態未能寫入資料庫，請稍後再試" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, title: craft.title, wvpChapterId });
}
