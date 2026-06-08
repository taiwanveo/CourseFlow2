import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serveWvpEmbedAsset } from "@/lib/wvp-embed-serve";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path?: string[] }> },
) {
  const { id, path: segments } = await params;
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

  return serveWvpEmbedAsset({
    supabase,
    userId: user.id,
    projectId: id,
    segments,
  });
}
