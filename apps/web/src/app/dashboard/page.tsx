import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/DashboardClient";
import { AppShell } from "@/components/app/AppShell";
import { formatProjectDateTime } from "@/lib/format-datetime";
import { hasBuiltPresentation } from "@/lib/wvp-workdir";
import { hasWvpDistInStorage } from "@/lib/wvp-dist-storage";

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

  const initialProjects = await Promise.all(
    (projects ?? []).map(async (p) => {
      const localBuilt = await hasBuiltPresentation(p.id);
      const storageBuilt = localBuilt
        ? true
        : await hasWvpDistInStorage(supabase, user!.id, p.id);
      return {
        id: p.id,
        title: p.title,
        updatedAtLabel: formatProjectDateTime(p.updated_at),
        previewBuilt: localBuilt || storageBuilt,
      };
    }),
  );

  return (
    <AppShell
      title="我的專案"
      description="教學影片專案管理。"
    >
      <DashboardClient initialProjects={initialProjects} />
    </AppShell>
  );
}
