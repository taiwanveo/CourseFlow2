import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { loadProjectComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { parseWvpSettings } from "@/lib/wvp-settings";
import {
  getChapterIllustrationsState,
  patchChapterIllustrationPrompts,
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

/** 取得本章配圖提示詞／狀態 */
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

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) {
    return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
  }

  const state = await getChapterIllustrationsState(
    supabase,
    user.id,
    id,
    loaded.craft!,
    composition,
  );
  return NextResponse.json({ ok: true, ...state });
}

/** 更新提示詞或標記已確認 */
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
    patches?: Array<{
      stepIndex: number;
      promptForApi?: string;
      confirm?: boolean;
      needsImage?: boolean;
      imageSource?: "ai" | "upload";
      batchSelected?: boolean;
    }>;
  };
  if (!body.patches?.length) {
    return NextResponse.json({ error: "缺少 patches" }, { status: 400 });
  }

  await patchChapterIllustrationPrompts(
    supabase,
    id,
    loaded.craft!,
    body.patches,
  );

  const { data: updatedCraft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .single();
  if (!updatedCraft) {
    return NextResponse.json({ error: "章節不存在" }, { status: 404 });
  }

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) {
    return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
  }

  const fullState = await getChapterIllustrationsState(
    supabase,
    user.id,
    id,
    updatedCraft,
    composition,
  );
  return NextResponse.json({ ok: true, ...fullState });
}
