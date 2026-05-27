import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { canAccessWvpPhase } from "@courseflow/core";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { VisualPhaseClient } from "@/components/VisualPhaseClient";
import { AppShell } from "@/components/app/AppShell";

export default async function VisualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) redirect("/dashboard");

  const locks = resolveWvpPhaseLocks(project);
  if (!canAccessWvpPhase(locks, "craft") && !locks.publish) {
    redirect(`/projects/${id}/craft`);
  }

  const composition = await loadProjectComposition(supabase, id);

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 視覺動效`}
      breadcrumb={[
        { label: "我的專案", href: "/dashboard" },
        { label: project.title, href: `/projects/${id}/craft` },
        { label: "進階 Konva（舊）" },
      ]}
    >
      <p className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/90">
        此為 v1 Konva 投影片編輯器（相容用）。v2 主流程請在「視覺動效」同步口播、產生 AI 章節程式碼，並以 WVP 播放器預覽與匯出 MP4。
      </p>
      <VisualPhaseClient
        projectId={id}
        projectTitle={project.title}
        initialComposition={composition!}
        initialLocks={locks}
      />
    </AppShell>
  );
}
