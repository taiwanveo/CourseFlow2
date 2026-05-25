import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertPhaseEditable } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { getSubtitlesQueue } from "@/lib/queue";

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
    .select("phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, "audio");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const { data: jobRun } = await supabase
    .from("job_runs")
    .insert({
      project_id: id,
      user_id: user.id,
      job_type: "generate-subtitles",
    })
    .select()
    .single();

  try {
    await getSubtitlesQueue().add("transcribe", {
      projectId: id,
      userId: user.id,
      jobRunId: jobRun?.id,
    });
  } catch {
    /* fallback */
  }

  return NextResponse.json({ ok: true, jobRunId: jobRun?.id });
}
