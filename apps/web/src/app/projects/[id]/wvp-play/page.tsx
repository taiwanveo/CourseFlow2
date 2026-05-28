import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureWvpDistLocal } from "@/lib/wvp-dist-storage";
import {
  isPresentationRevisionBuilt,
  wvpEmbedBasePath,
} from "@/lib/wvp-workdir";
import { WvpPlayShell } from "@/components/WvpPlayShell";
import { WvpPlayNotReady } from "@/components/WvpPlayNotReady";

export default async function WvpPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; audio?: string; anchor?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const anchorPreview = q.anchor === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("title, presentation_revision")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) redirect("/dashboard");

  const built = await ensureWvpDistLocal(supabase, user.id, id);
  if (!built) {
    const reason = isPresentationRevisionBuilt(project.presentation_revision)
      ? "build-stale"
      : "not-built";
    return (
      <WvpPlayNotReady
        projectId={id}
        projectTitle={project.title}
        reason={reason}
        returnHref={anchorPreview ? `/projects/${id}/craft` : undefined}
      />
    );
  }

  let anchorWvpChapterId: string | undefined;
  if (anchorPreview) {
    const supabase2 = await createClient();
    const { data: firstCraft } = await supabase2
      .from("chapter_craft")
      .select("wvp_chapter_id")
      .eq("project_id", id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    anchorWvpChapterId = firstCraft?.wvp_chapter_id;
  }

  const base = wvpEmbedBasePath(id);
  const query = new URLSearchParams();
  query.set("start", "1");
  query.set("cf_project", id);
  if (q.auto === "1") query.set("auto", "1");
  if (q.audio === "1") query.set("audio", "1");
  const src = `${base}?${query.toString()}`;

  return (
    <WvpPlayShell
      projectId={id}
      projectTitle={project.title}
      iframeSrc={src}
      anchorPreview={anchorPreview}
      anchorWvpChapterId={anchorWvpChapterId}
    />
  );
}
