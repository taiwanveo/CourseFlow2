import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readChapterIllustrationImage } from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string; stepIndex: string }> },
) {
  const { id, wvpChapterId, stepIndex: stepIndexRaw } = await params;
  const stepIndex = Number.parseInt(stepIndexRaw, 10);
  if (!Number.isFinite(stepIndex) || stepIndex < 0) {
    return new NextResponse("Invalid step", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("未登入", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return new NextResponse("找不到專案", { status: 404 });

  const buf = await readChapterIllustrationImage(id, wvpChapterId, stepIndex);
  if (!buf?.length) return new NextResponse("尚無配圖", { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
