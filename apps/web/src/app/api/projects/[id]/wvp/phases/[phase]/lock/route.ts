import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  lockWvpPhase,
  normalizeWvpPhaseLocks,
  unlockWvpPhase,
  type WvpPhaseId,
} from "@courseflow/core";
import type { WvpPhaseLocks } from "@courseflow/core";
import { createClient } from "@/lib/supabase/server";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";

const WVP_PHASES: WvpPhaseId[] = ["content", "checkpoint", "craft", "audio", "publish"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> },
) {
  const { id, phase } = await params;
  const phaseId = phase as WvpPhaseId;
  if (!WVP_PHASES.includes(phaseId)) {
    return NextResponse.json({ error: "無效階段" }, { status: 400 });
  }

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

  const body = (await req.json()) as { action: "lock" | "unlock" };
  let locks = resolveWvpPhaseLocks(project);

  if (body.action === "lock") {
    const result = lockWvpPhase(locks, phaseId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    locks = result.locks;
  } else {
    locks = unlockWvpPhase(locks, phaseId);
  }

  const legacy = { ...(project.phase_locks as Record<string, boolean> | null) };
  if (phaseId === "content") legacy.content = locks.content;
  if (phaseId === "audio") legacy.audio = locks.audio;
  if (phaseId === "craft" || phaseId === "publish") {
    legacy.visual = locks.publish;
  }

  locks = normalizeWvpPhaseLocks(locks);

  const { data, error } = await supabase
    .from("projects")
    .update({ wvp_phase_locks: locks, phase_locks: legacy })
    .eq("id", id)
    .select("wvp_phase_locks, phase_locks")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    wvp_phase_locks: data
      ? resolveWvpPhaseLocks(data)
      : normalizeWvpPhaseLocks(locks),
    phase_locks: data?.phase_locks ?? legacy,
  });
}
