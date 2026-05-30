import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { parseWvpSettings } from "@/lib/wvp-settings";
import {
  getChapterIllustrationEntryState,
  patchChapterIllustrationEntry,
} from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";

async function loadCraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string,
  wvpChapterId: string,
) {
  const { data: project } = await supabase
    .from("projects")
    .select("wvp_phase_locks, phase_locks")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  if (!project) return { error: NextResponse.json({ error: "找不到專案" }, { status: 404 }) };

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return { error: NextResponse.json({ error: (e as Error).message }, { status: 403 }) };
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return { error: NextResponse.json({ error: "章節不存在" }, { status: 404 }) };

  return { craft, project };
}

/** 取得本章配圖狀態（ChapterIllustrationEntry） */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const loaded = await loadCraft(supabase, id, user.id, wvpChapterId);
  if ("error" in loaded && loaded.error) return loaded.error;

  const entry = await getChapterIllustrationEntryState(
    supabase,
    user.id,
    id,
    loaded.craft!,
  );
  return NextResponse.json({ ok: true, wvpChapterId, chapterIllustration: entry });
}

/** 更新章節配圖設定（visualMode / promptForApi / confirm） */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const loaded = await loadCraft(supabase, id, user.id, wvpChapterId);
  if ("error" in loaded && loaded.error) return loaded.error;

  const body = (await req.json()) as {
    visualMode?: "animation" | "ai-image" | "upload";
    promptForApi?: string;
    confirm?: boolean;
  };

  const entry = await patchChapterIllustrationEntry(
    supabase,
    id,
    loaded.craft!,
    {
      ...(body.visualMode !== undefined ? { visualMode: body.visualMode } : {}),
      ...(body.promptForApi !== undefined ? { promptForApi: body.promptForApi } : {}),
      ...(body.confirm !== undefined ? { confirm: body.confirm } as Record<string, unknown> : {}),
    },
  );
  return NextResponse.json({ ok: true, wvpChapterId, chapterIllustration: entry });
}

