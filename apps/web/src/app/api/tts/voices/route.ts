import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTtsOptionsForUser } from "@/lib/load-tts-options";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const language = req.nextUrl.searchParams.get("language") ?? "zh-TW";
  const payload = await loadTtsOptionsForUser(supabase, user.id, language);
  return NextResponse.json(payload);
}
