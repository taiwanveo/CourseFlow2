import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { resolvePublicProjectBySlug } from "@/lib/resolve-public-project";
import { serveWvpEmbedAsset } from "@/lib/wvp-embed-serve";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug, path: segments } = await params;
  const project = await resolvePublicProjectBySlug(slug);
  if (!project) return new NextResponse("找不到分享課程", { status: 404 });

  const supabase = createServiceClient();
  return serveWvpEmbedAsset({
    supabase,
    userId: project.user_id,
    projectId: project.id,
    segments,
  });
}
