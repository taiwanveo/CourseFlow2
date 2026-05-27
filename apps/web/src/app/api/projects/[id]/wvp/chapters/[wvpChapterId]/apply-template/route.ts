import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { assertWvpPhaseEditable } from "@courseflow/core";
import type { WvpChapterKind } from "@courseflow/core";
import { applyChapterTemplate } from "@/lib/wvp-chapter-craft";
import { loadProjectComposition } from "@/lib/project-composition";
import { parseWvpSettings } from "@/lib/wvp-settings";

const ALLOWED: WvpChapterKind[] = ["list-reveal", "flow", "hook"];

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

  const { data: project } = await supabase
    .from("projects")
    .select("wvp_phase_locks, phase_locks, wvp_settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertWvpPhaseEditable(resolveWvpPhaseLocks(project), "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { template?: string };
  const template = body.template as WvpChapterKind;
  if (!ALLOWED.includes(template)) {
    return NextResponse.json(
      { error: "template 須為 list-reveal、flow 或 hook" },
      { status: 400 },
    );
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .single();
  if (!craft) return NextResponse.json({ error: "找不到章節" }, { status: 404 });

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) return NextResponse.json({ error: "無法載入內容" }, { status: 400 });

  const wvpSettings = parseWvpSettings(project.wvp_settings);
  const result = await applyChapterTemplate(
    supabase,
    id,
    craft,
    composition,
    template,
    wvpSettings.assets,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    templateKind: result.templateKind,
    stepCount: result.narrations?.length,
  });
}
