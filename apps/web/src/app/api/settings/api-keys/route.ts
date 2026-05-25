import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey } from "@/lib/crypto";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data } = await supabase
    .from("user_api_keys")
    .select("provider, updated_at")
    .eq("user_id", user.id);
  return NextResponse.json({
    providers: (data ?? []).map((r: { provider: string; updated_at: string }) => ({
      provider: r.provider,
      configured: true,
      updatedAt: r.updated_at,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json()) as { provider: string; apiKey: string };
  if (!body.provider || !body.apiKey?.trim()) {
    return NextResponse.json({ error: "缺少 provider 或 apiKey" }, { status: 400 });
  }

  const { error } = await supabase.from("user_api_keys").upsert(
    {
      user_id: user.id,
      provider: body.provider,
      encrypted_key: encryptApiKey(body.apiKey.trim()),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "缺少 provider" }, { status: 400 });

  await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);
  return NextResponse.json({ ok: true });
}
