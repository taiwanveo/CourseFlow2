import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { buildThemeStylesCss } from "@courseflow/wvp-bridge";
import { PlayPageClient } from "@/components/PlayPageClient";

export default async function PlayPage({
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

  const composition = await loadProjectComposition(supabase, id);
  const themeId = composition?.meta.themeId ?? project.theme_id;
  const themeStylesCss = themeId ? buildThemeStylesCss(themeId) ?? undefined : undefined;

  return <PlayPageClient projectId={id} composition={composition!} themeTokensCss={themeStylesCss} />;
}
