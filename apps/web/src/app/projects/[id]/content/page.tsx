import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { parseWvpSettings } from "@/lib/wvp-settings";
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
  const locks = resolveWvpPhaseLocks(project);

  const article = project.article as { rawText?: string } | null;
  const initialArticleText = article?.rawText ?? "";

  return (
    <AppShell
      width="wide"
      title={`${project.title} — 文稿內容`}
      description="第一階段：輸入提示詞或教學文稿，AI 一次生成結構大綱與口播稿。"
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
        initialWvpSettings={parseWvpSettings(project.wvp_settings)}
        initialThemeId={project.theme_id}
      />
    </AppShell>
  );
}
