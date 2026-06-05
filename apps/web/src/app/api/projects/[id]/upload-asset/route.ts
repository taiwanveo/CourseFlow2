import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  isStorageAllowedAudioMime,
  normalizeAudioMimeType,
} from "@/lib/audio-upload";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_KINDS = new Set(["image", "background", "bgm", "audio"]);

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
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "不支援的資產類型" }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()! : "bin";
  const storagePath = `${user.id}/${projectId}/${kind}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = normalizeAudioMimeType(file.type) || "application/octet-stream";

  if (kind === "audio" && !isStorageAllowedAudioMime(contentType)) {
    return NextResponse.json(
      {
        error:
          "此音訊格式無法上傳至儲存空間。請重新錄音存檔，或改上傳 mp3／wav 音檔。",
      },
      { status: 400 },
    );
  }

  const { error: uploadError } = await supabase.storage
    .from("courseflow-assets")
    .upload(storagePath, buffer, {
      contentType,
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
  });
}
