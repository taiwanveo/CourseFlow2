import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { CourseComposition } from "@courseflow/core";
import { assertPhaseEditable, ensureChapterDividerSteps } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition, saveComposition } from "@/lib/project-composition";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: projectRow } = await supabase
    .from("projects")
    .select("phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  const project = projectRow as { phase_locks: PhaseLocks } | null;
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const body = (await req.json()) as {
    phase: "content" | "audio" | "visual";
    composition: CourseComposition;
  };

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, body.phase);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  let composition = ensureChapterDividerSteps(body.composition);

  if (body.phase === "audio") {
    const existing = await loadProjectComposition(supabase, id);
    const incomingCount = composition.audio.filter(
      (a) => a.stepId && (a.storagePath?.trim() || a.publicUrl?.trim()),
    ).length;
    const existingCount = (existing?.audio ?? []).filter(
      (a) => a.stepId && (a.storagePath?.trim() || a.publicUrl?.trim()),
    ).length;
    if (incomingCount === 0 && existingCount > 0) {
      composition = { ...composition, audio: existing!.audio };
    }
  }

  await saveComposition(supabase, id, composition);

  if (body.phase === "content") {
    for (const step of composition.steps) {
      await supabase
        .from("steps")
        .update({
          script: step.script,
          screen_summary: step.screenContent,
          info_pool: step.infoPool,
        })
        .eq("id", step.id);
    }
    for (const ch of composition.chapters) {
      await supabase
        .from("chapters")
        .update({ title: ch.title, sort_order: ch.sortOrder, parent_id: ch.parentId })
        .eq("id", ch.id);
    }
  }

  return NextResponse.json({ ok: true });
}
