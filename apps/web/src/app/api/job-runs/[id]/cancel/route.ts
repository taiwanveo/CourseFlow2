import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CancelBody = {
  /** 立即標記失敗（適用僵死任務），不等待背景程序協作結束 */
  force?: boolean;
};

/** 取消進行中的 job_runs 背景任務（協作式或強制結束） */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CancelBody;
  const force = body.force === true;

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
  const cancellable = status === "pending" || status === "running" || status === "cancelling";
  if (!cancellable) {
    return NextResponse.json({ error: "此任務已無法取消" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("job_runs")
    .update({
      status: force ? "failed" : "cancelling",
      error_message: force ? "使用者已清除任務" : null,
      updated_at: nowIso,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    jobRunId: id,
    forced: force,
    message: force
      ? "已清除任務，可重新打包"
      : "已送出取消請求，正在完成目前步驟…",
  });
}
