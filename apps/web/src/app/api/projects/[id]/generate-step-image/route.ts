import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { assertPhaseEditable } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { decryptApiKey } from "@/lib/crypto";
import {
  buildStepImagePrompt,
  generateStepImage,
  IMAGE_GENERATION_PROVIDERS,
} from "@courseflow/llm";
import type { LlmProviderId } from "@courseflow/llm";
import { getOrderedSteps } from "@courseflow/core";
import { loadProjectComposition } from "@/lib/project-composition";
import { listConfiguredLlmProviders } from "@/lib/llm-provider";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("phase_locks, title")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, "visual");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json()) as {
    stepId: string;
    target?: "element" | "background";
    prompt?: string;
    provider?: LlmProviderId;
  };
  if (!body.stepId) {
    return NextResponse.json({ error: "缺少 stepId" }, { status: 400 });
  }

  const composition = await loadProjectComposition(supabase, projectId);
  if (!composition) {
    return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
  }

  const step = getOrderedSteps(composition).find((s) => s.id === body.stepId);
  if (!step) {
    return NextResponse.json({ error: "找不到步驟" }, { status: 404 });
  }

  const configured = await listConfiguredLlmProviders(supabase, user.id);
  const imageProviders = IMAGE_GENERATION_PROVIDERS.filter((p) => configured.includes(p));
  if (imageProviders.length === 0) {
    return NextResponse.json(
      {
        error:
          "AI 生圖需要 OpenAI 或 OpenRouter API Key，請至設定頁填寫至少一組",
      },
      { status: 400 },
    );
  }

  const provider =
    body.provider && imageProviders.includes(body.provider)
      ? body.provider
      : imageProviders[0]!;

  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();
  if (!keyRow?.encrypted_key) {
    return NextResponse.json({ error: `找不到 ${provider} API Key` }, { status: 400 });
  }

  const prompt =
    body.prompt?.trim() ||
    buildStepImagePrompt({
      courseTopic: project.title ?? composition.meta.language,
      screenContent: step.screenContent,
      script: step.script ?? "",
    });

  try {
    const buffer = await generateStepImage(
      { provider, apiKey: decryptApiKey(keyRow.encrypted_key) },
      prompt,
    );

    const storagePath = `${user.id}/${projectId}/image/${randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("courseflow-assets")
      .upload(storagePath, Buffer.from(buffer), {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("courseflow-assets")
      .getPublicUrl(storagePath);

    return NextResponse.json({
      storagePath,
      publicUrl: urlData.publicUrl,
      target: body.target ?? "element",
      provider,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 生圖失敗" },
      { status: 500 },
    );
  }
}
