import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { presentationDirForProject } from "@/lib/wvp-workdir";

type Severity = "ok" | "warn" | "fail";

interface Finding {
  level: Severity;
  message: string;
}

interface StepResult {
  chapterId: string;
  chapterIdx: number;
  stepIdx: number;
  pageLabel: string;
  narration: string;
  largestVisibleFontPx: number;
  hasOverflow: boolean;
  pageNumberOk: boolean | null;
  subtitleVisible: boolean;
  subtitleTextMatches: boolean;
  subsOffHides: boolean | null;
  findings: Finding[];
}

function worstLevel(findings: Finding[]): Severity {
  if (findings.some((f) => f.level === "fail")) return "fail";
  if (findings.some((f) => f.level === "warn")) return "warn";
  return "ok";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const reportPath = join(presentationDirForProject(id), "self-check-report.json");

  let raw: string;
  try {
    raw = await readFile(reportPath, "utf8");
  } catch {
    return NextResponse.json({ exists: false });
  }

  let results: StepResult[];
  try {
    results = JSON.parse(raw) as StepResult[];
  } catch {
    return NextResponse.json({ exists: false });
  }

  let ok = 0, warn = 0, fail = 0;
  for (const r of results) {
    const w = worstLevel(r.findings);
    if (w === "fail") fail++;
    else if (w === "warn") warn++;
    else ok++;
  }

  return NextResponse.json({
    exists: true,
    totals: { ok, warn, fail },
    results,
  });
}
