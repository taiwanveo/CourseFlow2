import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { evaluateProjectMotionPlan } from "@/lib/wvp-motion-plan";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) return NextResponse.json({ error: "無法載入專案內容" }, { status: 404 });

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("wvp_chapter_id, title, checklist_result")
    .eq("project_id", id)
    .order("sort_order");

  const plan = evaluateProjectMotionPlan(composition, crafts ?? []);
  return NextResponse.json({ ok: true, plan });
}
