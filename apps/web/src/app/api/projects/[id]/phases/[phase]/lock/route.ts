import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { PhaseId } from "@courseflow/core";
import { lockPhase, unlockPhase, DEFAULT_PHASE_LOCKS, lockWvpPhase, unlockWvpPhase } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { validateContentPhase } from "@courseflow/core";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition, saveComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks, syncWvpLocksFromLegacyLock } from "@/lib/wvp-locks";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> },
) {
  const { id, phase } = await params;
  const phaseId = phase as PhaseId;
  if (!["content", "audio", "visual"].includes(phaseId)) {
    return NextResponse.json({ error: "無效階段" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("phase_locks, wvp_phase_locks, composition_snapshot")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const body = (await req.json()) as { action: "lock" | "unlock" };
  let locks = (project.phase_locks as PhaseLocks) ?? DEFAULT_PHASE_LOCKS;
  let wvpLocks = resolveWvpPhaseLocks(project);

  if (body.action === "lock") {
    if (phaseId === "content") {
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
    const result = lockPhase(locks, phaseId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    locks = result.locks;
    wvpLocks = syncWvpLocksFromLegacyLock(wvpLocks, phaseId, true);
    if (phaseId === "content") {
      const wvpResult = lockWvpPhase(wvpLocks, "content");
      if (wvpResult.ok) wvpLocks = wvpResult.locks;
    }
  } else {
    locks = unlockPhase(locks, phaseId);
    wvpLocks = syncWvpLocksFromLegacyLock(wvpLocks, phaseId, false);
    if (phaseId === "content") wvpLocks = unlockWvpPhase(wvpLocks, "content");
    else if (phaseId === "audio") wvpLocks = unlockWvpPhase(wvpLocks, "audio");
    else if (phaseId === "visual") wvpLocks = unlockWvpPhase(wvpLocks, "craft");
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ phase_locks: locks, wvp_phase_locks: wvpLocks })
    .eq("id", id)
    .select("phase_locks, wvp_phase_locks")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    phase_locks: data.phase_locks,
    wvp_phase_locks: data.wvp_phase_locks,
  });
}
