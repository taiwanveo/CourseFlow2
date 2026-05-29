import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json()) as {
    provider: string;
    defaultModel: string;
    textModel?: string;
    imageModel?: string;
  };
  if (!body.provider?.trim() || !body.defaultModel?.trim())
    return NextResponse.json(
      { error: "缺少 provider 或 defaultModel" },
      { status: 400 },
    );

  const { error } = await supabase
    .from("user_api_keys")
    .update({
      default_model: body.defaultModel.trim(),
      text_model: body.textModel?.trim() || null,
      image_model: body.imageModel?.trim() || null,
    })
    .eq("user_id", user.id)
    .eq("provider", body.provider);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
