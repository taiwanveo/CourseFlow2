import Link from "next/link";
import { publicWatchEmbedBase } from "@/lib/public-share";
import {
  isPublicProjectPlayable,
  resolvePublicProjectBySlug,
} from "@/lib/resolve-public-project";
import { WvpPlayShell } from "@/components/WvpPlayShell";

export default async function PublicWatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ auto?: string; subs?: string }>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const project = await resolvePublicProjectBySlug(slug);

  if (!project) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-medium text-zinc-200">找不到此分享連結</h1>
        <p className="text-sm text-zinc-500">連結可能已失效，或講師尚未開放觀看。</p>
        <Link href="/login" className="text-sm text-emerald-500 underline hover:text-emerald-400">
          講師登入 CourseFlow
        </Link>
      </main>
    );
  }

  const playable = await isPublicProjectPlayable(project);
  if (!playable) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-medium text-zinc-200">「{project.title}」尚未可播放</h1>
        <p className="text-sm text-zinc-500">講師可能尚未完成打包預覽，請稍後再試。</p>
      </main>
    );
  }

  const base = publicWatchEmbedBase(slug);
  const query = new URLSearchParams();
  query.set("chapter", "0");
  query.set("step", "0");
  query.set("cf_project", project.id);
  query.set("external_controls", "1");
  query.set("auto", q.auto === "0" ? "0" : "1");
  query.set("audio", "1");
  if (q.subs === "off") query.set("subs", "off");
  if (project.presentation_revision) {
    query.set("cf_rev", project.presentation_revision);
  }
  const src = `${base}?${query.toString()}`;

  return (
    <WvpPlayShell
      projectId={project.id}
      projectTitle={project.title}
      iframeSrc={src}
      publicView
      hideBackLink
    />
  );
}
