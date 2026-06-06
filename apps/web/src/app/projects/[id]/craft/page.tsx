import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessWvpPhase } from "@courseflow/core";
import { CraftPhaseClient } from "@/components/CraftPhaseClient";
import { AppShell } from "@/components/app/AppShell";
import { loadProjectComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { parseWvpSettings } from "@/lib/wvp-settings";

export default async function CraftPage({
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
  if (!canAccessWvpPhase(locks, "craft")) redirect(`/projects/${id}/content`);

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) {
    redirect(`/projects/${id}/content`);
  }
  const { data: chapters } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .order("sort_order");

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 視覺動效`}
      breadcrumb={[
        { label: "我的專案", href: "/dashboard" },
        { label: project.title, href: `/projects/${id}/content` },
        { label: "視覺動效" },
      ]}
    >
      <CraftPhaseClient
        projectId={id}
        initialLocks={locks}
        initialSettings={parseWvpSettings(project.wvp_settings)}
        initialThemeId={project.theme_id}
        initialChapters={chapters ?? []}
        initialComposition={composition}
      />
    </AppShell>
  );
}
