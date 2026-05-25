import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { TtsProviderId } from "@courseflow/tts";
import { runSynthesizeAudio } from "@/lib/run-synthesize-audio";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest) {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) return false;
  return req.headers.get("x-courseflow-internal") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    projectId: string;
    userId: string;
    provider: string;
    voiceId: string;
    model?: string;
    stepIds?: string[];
    jobRunId?: string;
  };

  if (!body.projectId || !body.userId || !body.voiceId?.trim()) {
    return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
  }

  try {
    await runSynthesizeAudio({
      projectId: body.projectId,
      userId: body.userId,
      provider: body.provider as TtsProviderId,
      voiceId: body.voiceId,
      model: body.model,
      stepIds: body.stepIds,
    });
    return NextResponse.json({ ok: true, jobRunId: body.jobRunId ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
