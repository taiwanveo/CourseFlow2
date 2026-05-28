import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import { evaluateProjectExportReadiness } from "@/lib/wvp-export-readiness";
import { loadProjectComposition } from "@/lib/project-composition";
import { parseWvpSettings } from "@/lib/wvp-settings";
import { ensureWvpDistLocal } from "@/lib/wvp-dist-storage";

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

  const { data: project } = await supabase
    .from("projects")
    .select("wvp_settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const settings = parseWvpSettings(project.wvp_settings);
  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("wvp_chapter_id, craft_status, checklist_result, title")
    .eq("project_id", id)
    .order("sort_order");

  const rows = crafts ?? [];
  const anchorOk = !!settings.anchorChapterApproved;
  const built = await ensureWvpDistLocal(supabase, user.id, id);
  const composition = await loadProjectComposition(supabase, id);
  const audioGate = composition
    ? evaluateWvpAudioBuildGate(composition)
    : { ready: false, message: "無法載入專案內容" };

  const result = evaluateProjectExportReadiness({
    chapters: rows,
    anchorOk,
    built,
    audioReady: audioGate.ready,
    audioMessage: audioGate.message,
  });

  return NextResponse.json(result);
}
