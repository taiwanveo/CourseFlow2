import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { loadTtsOptionsForUser } from "@/lib/load-tts-options";
import type { PhaseLocks } from "@courseflow/core";
import { canAccessPhase } from "@courseflow/core";
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

  const locks = project.phase_locks as PhaseLocks;
  if (!canAccessPhase(locks, "audio")) redirect(`/projects/${id}/content`);

  const composition = await loadProjectComposition(supabase, id);
  const language = (project.settings as { language?: string })?.language ?? "zh-TW";
  const ttsOptions = await loadTtsOptionsForUser(supabase, user.id, language);

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 語音字幕`}
      breadcrumb={[
        { label: "我的專案", href: "/dashboard" },
        { label: project.title, href: `/projects/${id}/content` },
        { label: "語音字幕" },
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
