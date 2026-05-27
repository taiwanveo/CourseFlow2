import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWvpSettings } from "@/lib/wvp-settings";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { chapterComponentName } from "@courseflow/presentation";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: crafts } = await supabase
    .from("chapter_craft")
    .select("id, wvp_chapter_id, sort_order, title, presentation_path, checklist_result")
    .eq("project_id", id)
    .order("sort_order");

  const first = crafts?.[0];
  if (!first || first.wvp_chapter_id !== wvpChapterId) {
    return NextResponse.json(
      { error: "僅能驗收排序第一個章節作為風格錨點" },
      { status: 400 },
    );
  }

  await supabase
    .from("chapter_craft")
    .update({ craft_status: "approved" })
    .eq("id", first.id);

  const { data: project } = await supabase
    .from("projects")
    .select("wvp_settings, theme_id")
    .eq("id", id)
    .single();

  const settings = parseWvpSettings(project?.wvp_settings);
  settings.anchorChapterApproved = true;

  const folder =
    first.presentation_path?.split("/").pop() ??
    `${String(first.sort_order).padStart(2, "0")}-${wvpChapterId}`;
  const componentName = `Chapter${chapterComponentName(wvpChapterId)}`;
  let tsxExcerpt = "";
  let templateKind = "magazine";
  try {
    const tsx = await readFile(
      join(presentationDirForProject(id), "src", "chapters", folder, `${componentName}.tsx`),
      "utf8",
    );
    tsxExcerpt = tsx.slice(0, 2800);
    if (tsx.includes("ListRevealGrid")) templateKind = "list-reveal";
    else if (tsx.includes("FlowDiagram")) templateKind = "flow";
  } catch {
    const src = (first.checklist_result as { chapterSource?: { chapterTsx?: string } })
      ?.chapterSource?.chapterTsx;
    if (src) {
      tsxExcerpt = src.slice(0, 2800);
      if (src.includes("ListRevealGrid")) templateKind = "list-reveal";
      else if (src.includes("FlowDiagram")) templateKind = "flow";
    }
  }

  const plan = (first.checklist_result as { aiPlan?: { stepVisuals?: { vizType?: string }[] } })
    ?.aiPlan;
  settings.anchorProfile = {
    wvpChapterId,
    chapterTitle: first.title,
    themeId: project?.theme_id ?? settings.themeId ?? undefined,
    templateKind,
    vizTypes: plan?.stepVisuals?.map((v) => v.vizType).filter(Boolean) as string[],
    tsxExcerpt,
    approvedAt: new Date().toISOString(),
  };

  await supabase.from("projects").update({ wvp_settings: settings }).eq("id", id);

  return NextResponse.json({
    ok: true,
    anchorChapterApproved: true,
    anchorProfile: settings.anchorProfile,
  });
}
