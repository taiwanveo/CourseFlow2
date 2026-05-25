import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/DashboardClient";
import { AppShell } from "@/components/app/AppShell";
import { formatProjectDateTime } from "@/lib/format-datetime";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, updated_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  const initialProjects = (projects ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    updatedAtLabel: formatProjectDateTime(p.updated_at),
  }));

  return (
    <AppShell
      title="我的專案"
      description="管理教學影片專案，從文稿到匯出 MP4 的完整工作流。"
    >
      <DashboardClient initialProjects={initialProjects} />
    </AppShell>
  );
}
