import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
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
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const { data: job } = await supabase
    .from("render_jobs")
    .select("id, status, output_path, created_at, progress")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .eq("kind", "export")
    .eq("status", "completed")
    .not("output_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job?.output_path) {
    return NextResponse.json({ job: null, downloadUrl: null });
  }

  const { data } = await supabase.storage
    .from("courseflow-assets")
    .createSignedUrl(job.output_path, 3600);

  return NextResponse.json({
    job,
    downloadUrl: data?.signedUrl ?? null,
  });
}
