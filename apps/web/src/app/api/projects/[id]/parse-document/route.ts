import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDocument } from "@/lib/parse-document";
import { assertPhaseEditable } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";

export async function POST(
  req: NextRequest,
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
    .select("phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, "content");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const paste = form.get("text") as string | null;

  let text = paste ?? "";
  let format = "txt";
  let fileName = "paste.txt";

  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(buffer, file.name, file.type);
    text = parsed.text;
    format = parsed.format;
    fileName = file.name;
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "內容為空" }, { status: 400 });
  }

  const { error } = await supabase
    .from("projects")
    .update({
      article: { rawText: text, format, fileName },
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, length: text.length, format, text });
}
