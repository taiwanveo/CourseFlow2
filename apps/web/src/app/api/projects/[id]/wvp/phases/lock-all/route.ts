import { NextResponse } from "next/server";
import {
  DEFAULT_PHASE_LOCKS,
  lockAllWvpPhases,
  normalizeWvpPhaseLocks,
  validateContentPhase,
} from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition, saveComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";

/** 一次鎖定全部四階段（文稿修改完畢後快速恢復鎖定狀態） */
export async function PATCH(
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
    .select("wvp_phase_locks, phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  let locks = resolveWvpPhaseLocks(project);

  if (!locks.content) {
    const composition = await loadProjectComposition(supabase, id);
    if (!composition) {
      return NextResponse.json({ error: "無法載入內容" }, { status: 400 });
    }
    const errors = validateContentPhase(composition);
    if (errors.length) {
      return NextResponse.json({ error: errors.join("；") }, { status: 400 });
    }
    await saveComposition(supabase, id, composition);
  }

  const result = lockAllWvpPhases(locks);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  locks = result.locks;

  const legacy: PhaseLocks = {
    ...(DEFAULT_PHASE_LOCKS as PhaseLocks),
    ...((project.phase_locks as PhaseLocks | null) ?? {}),
    content: locks.content,
    audio: locks.audio,
    visual: locks.publish,
  };

  const { data, error } = await supabase
    .from("projects")
    .update({
      wvp_phase_locks: normalizeWvpPhaseLocks(locks),
      phase_locks: legacy,
    })
    .eq("id", id)
    .select("wvp_phase_locks, phase_locks")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    wvp_phase_locks: data ? resolveWvpPhaseLocks(data) : normalizeWvpPhaseLocks(locks),
    phase_locks: data?.phase_locks ?? legacy,
  });
}
