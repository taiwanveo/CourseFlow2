import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessWvpPhase } from "@courseflow/core";
import { loadProjectComposition } from "@/lib/project-composition";
import { PublishPhaseClient } from "@/components/PublishPhaseClient";
import { AppShell } from "@/components/app/AppShell";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { hasBuiltPresentation } from "@/lib/wvp-workdir";

export default async function PublishPage({
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
  if (!canAccessWvpPhase(locks, "publish")) redirect(`/projects/${id}/audio`);

  const composition = await loadProjectComposition(supabase, id);
  const previewBuilt = await hasBuiltPresentation(id);

  const { data: chapters } = await supabase
    .from("chapter_craft")
    .select("wvp_chapter_id, title, craft_status, step_count")
    .eq("project_id", id)
    .order("sort_order");

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 預覽匯出`}
      breadcrumb={[
        { label: "我的專案", href: "/dashboard" },
        { label: project.title, href: `/projects/${id}/content` },
        { label: "預覽匯出" },
      ]}
    >
      <PublishPhaseClient
        projectId={id}
        initialLocks={locks}
        initialComposition={composition!}
        initialPreviewBuilt={previewBuilt}
        chapters={chapters ?? []}
      />
    </AppShell>
  );
}
