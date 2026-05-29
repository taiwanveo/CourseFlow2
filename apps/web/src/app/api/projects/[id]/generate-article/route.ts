import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertPhaseEditable } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { decryptApiKey } from "@/lib/crypto";
import { generateTeachingArticle } from "@courseflow/llm";
import type { LlmProviderId } from "@courseflow/llm";
import { resolveLlmProvider, resolveEffectiveTextModel } from "@/lib/llm-provider";

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
    .select("phase_locks, article, settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, "content");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json()) as {
    provider?: LlmProviderId;
    model?: string;
    prompt?: string;
  };

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "請輸入生成提示詞" }, { status: 400 });
  }

  const resolved = await resolveLlmProvider(supabase, user.id, body.provider);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { provider, encryptedKey } = resolved;

  const language =
    (project.settings as { language?: string })?.language ?? "zh-TW";

  try {
    const text = await generateTeachingArticle(
      {
        provider,
        apiKey: decryptApiKey(encryptedKey),
        model: resolveEffectiveTextModel(resolved.provider, resolved.textModel, resolved.defaultModel),
      },
      prompt,
      language,
    );

    const articleFromDb = project.article as {
      rawText?: string;
      format?: string;
      fileName?: string;
    };

    await supabase
      .from("projects")
      .update({
        article: {
          rawText: text,
          format: "txt",
          fileName: articleFromDb.fileName ?? "ai-generated.txt",
        },
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, text, length: text.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
