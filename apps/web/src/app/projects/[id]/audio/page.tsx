import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { loadTtsOptionsForUser } from "@/lib/load-tts-options";
import { canAccessWvpPhase } from "@courseflow/core";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { AudioPhaseClient } from "@/components/AudioPhaseClient";
import { AppShell } from "@/components/app/AppShell";

export default async function AudioPage({
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
  if (!canAccessWvpPhase(locks, "audio")) redirect(`/projects/${id}/craft`);

  const composition = await loadProjectComposition(supabase, id);
  const language = (project.settings as { language?: string })?.language ?? "zh-TW";
  const ttsOptions = await loadTtsOptionsForUser(supabase, user.id, language);

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 語音生成`}
      breadcrumb={[
        { label: "我的專案", href: "/dashboard" },
        { label: project.title, href: `/projects/${id}/content` },
        { label: "語音生成" },
      ]}
    >
      <AudioPhaseClient
        projectId={id}
        initialComposition={composition!}
        initialLocks={locks}
        language={language}
        initialVoices={ttsOptions.voices}
        initialModels={ttsOptions.models}
        initialProviders={ttsOptions.providers}
      />
    </AppShell>
  );
}
