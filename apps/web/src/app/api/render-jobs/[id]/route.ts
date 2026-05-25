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

  const { data: job, error } = await supabase
    .from("render_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !job) {
    return NextResponse.json({ error: "找不到任務" }, { status: 404 });
  }

  let downloadUrl: string | null = null;
  if (job.output_path && job.status === "completed") {
    const { data } = await supabase.storage
      .from("courseflow-assets")
      .createSignedUrl(job.output_path, 3600);
    downloadUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ job, downloadUrl });
}
