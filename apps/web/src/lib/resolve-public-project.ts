import { createServiceClient } from "@/lib/supabase/admin";
import { isPresentationRevisionBuilt } from "@/lib/wvp-workdir";
import { isWvpDistPlayable } from "@/lib/wvp-dist-storage";

export type PublicProjectRow = {
  id: string;
  user_id: string;
  title: string;
  public_slug: string;
  presentation_revision: string | null;
};

export async function resolvePublicProjectBySlug(
  slug: string,
): Promise<PublicProjectRow | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, title, public_slug, presentation_revision")
    .eq("public_slug", trimmed)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as PublicProjectRow;
  if (!row.public_slug) return null;
  return row;
}

export async function isPublicProjectPlayable(project: PublicProjectRow): Promise<boolean> {
  if (!isPresentationRevisionBuilt(project.presentation_revision)) return false;
  const supabase = createServiceClient();
  return isWvpDistPlayable(supabase, project.user_id, project.id);
}
