import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import type { PhaseLocks } from "@courseflow/core";
import { canAccessPhase } from "@courseflow/core";
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

  const locks = project.phase_locks as PhaseLocks;
  if (!canAccessPhase(locks, "visual")) redirect(`/projects/${id}/audio`);

  const composition = await loadProjectComposition(supabase, id);

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
      <VisualPhaseClient
        projectId={id}
        projectTitle={project.title}
        initialComposition={composition!}
        initialLocks={locks}
      />
    </AppShell>
  );
}
