import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import type { PhaseLocks } from "@courseflow/core";
import { ContentPhaseClient } from "@/components/ContentPhaseClient";
import { AppShell } from "@/components/app/AppShell";

export default async function ContentPage({
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
  const locks = project.phase_locks as PhaseLocks;

  const article = project.article as { rawText?: string } | null;
  const initialArticleText = article?.rawText ?? "";

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 文稿內容`}
      description="匯入教學文件、AI 產生大綱與口說稿，完成後鎖定進入下一階段。"
      breadcrumb={[
        { label: "我的專案", href: "/dashboard" },
        { label: project.title },
        { label: "文稿內容" },
      ]}
    >
      <ContentPhaseClient
        projectId={id}
        initialComposition={composition!}
        initialLocks={locks}
        initialArticleText={initialArticleText}
      />
    </AppShell>
  );
}
