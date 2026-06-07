import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 取消進行中的 job_runs 背景任務（協作式取消） */
export async function POST(
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
    .from("job_runs")
    .select("id, status, job_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "找不到任務" }, { status: 404 });
  }

  const status = job.status as string;
  if (status !== "pending" && status !== "running") {
    return NextResponse.json({ error: "此任務已無法取消" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("job_runs")
    .update({
      status: "cancelling",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    jobRunId: id,
    message: "已送出取消請求，正在完成目前章節…",
  });
}
