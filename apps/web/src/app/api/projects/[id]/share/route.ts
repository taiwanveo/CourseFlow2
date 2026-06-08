import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  absolutePublicWatchUrl,
  generatePublicShareSlug,
  publicWatchPath,
} from "@/lib/public-share";
import { isPresentationRevisionBuilt } from "@/lib/wvp-workdir";

export const runtime = "nodejs";

export async function GET(
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
    .select("public_slug, presentation_revision, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const origin = new URL(_req.url).origin;
  const slug = project.public_slug;
  return NextResponse.json({
    slug,
    shareUrl: slug ? absolutePublicWatchUrl(origin, slug, true) : null,
    watchPath: slug ? publicWatchPath(slug, { auto: true }) : null,
    previewBuilt: isPresentationRevisionBuilt(project.presentation_revision),
    title: project.title,
  });
}

export async function POST(
  req: Request,
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
    .select("public_slug, presentation_revision, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  if (!isPresentationRevisionBuilt(project.presentation_revision)) {
    return NextResponse.json(
      { error: "請先完成「打包課程預覽」再產生分享連結" },
      { status: 400 },
    );
  }

  let slug = project.public_slug?.trim() || "";
  const body = (await req.json().catch(() => ({}))) as { regenerate?: boolean };
  if (!slug || body.regenerate) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generatePublicShareSlug();
      const { data: conflict } = await supabase
        .from("projects")
        .select("id")
        .eq("public_slug", candidate)
        .maybeSingle();
      if (!conflict) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      return NextResponse.json({ error: "無法產生唯一分享代碼，請重試" }, { status: 500 });
    }
    const { error } = await supabase
      .from("projects")
      .update({ public_slug: slug })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    slug,
    shareUrl: absolutePublicWatchUrl(origin, slug, true),
    watchPath: publicWatchPath(slug, { auto: true }),
    title: project.title,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { error } = await supabase
    .from("projects")
    .update({ public_slug: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
