import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import {
  getChapterIllustrationEntryState,
  uploadChapterIllustrationImageEntry,
  readChapterIllustrationImageEntry,
} from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** 讀取章節配圖 */
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

  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return NextResponse.json({ error: "章節不存在" }, { status: 404 });

  const entry = await getChapterIllustrationEntryState(supabase, user.id, id, craft);
  const result = await readChapterIllustrationImageEntry(
    supabase,
    user.id,
    id,
    wvpChapterId,
    entry.storagePath,
  );
  if (!result) return NextResponse.json({ error: "找不到配圖" }, { status: 404 });

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** 上傳圖片作為章節配圖 */
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
    .select("wvp_phase_locks, phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .single();
  if (!craft) return NextResponse.json({ error: "章節不存在" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "缺少上傳檔案（field: file）" }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  if (arrayBuf.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "圖片過大（上限 20 MB）" }, { status: 413 });
  }

  const buffer = Buffer.from(arrayBuf);
  const mime = file.type || "application/octet-stream";
  const fileName = file.name || "upload.jpg";

  try {
    const entry = await uploadChapterIllustrationImageEntry(
      supabase,
      user.id,
      id,
      craft,
      buffer,
      { mime, fileName },
    );
    return NextResponse.json({ ok: true, wvpChapterId, chapterIllustration: entry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
