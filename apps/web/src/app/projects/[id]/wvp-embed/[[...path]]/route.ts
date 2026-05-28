import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWvpDistLocal } from "@/lib/wvp-dist-storage";
import { presentationDistDir } from "@/lib/wvp-workdir";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

function safeResolve(distRoot: string, segments: string[]): string | null {
  const rel = segments.length ? segments.join("/") : "index.html";
  const resolved = normalize(join(distRoot, rel));
  if (!resolved.startsWith(normalize(distRoot))) return null;
  return resolved;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path?: string[] }> },
) {
  const { id, path: segments } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("未登入", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return new NextResponse("找不到專案", { status: 404 });

  await ensureWvpDistLocal(supabase, user.id, id);

  const distRoot = presentationDistDir(id);
  let filePath = safeResolve(distRoot, segments ?? []);

  if (!filePath) return new NextResponse("Forbidden", { status: 403 });

  const lastSeg = segments?.length ? segments[segments.length - 1]! : "index.html";
  const isAsset =
    /\.(mp3|wav|m4a|ogg|css|js|map|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|json)$/i.test(
      lastSeg,
    );

  try {
    await readFile(filePath);
  } catch {
    if (isAsset) {
      return new NextResponse("Not found", { status: 404 });
    }
    filePath = safeResolve(distRoot, []);
    if (!filePath) return new NextResponse("Not found", { status: 404 });
    try {
      await readFile(filePath);
    } catch {
      return new NextResponse(
        "尚未建置 WVP 預覽。請在「3. 語音生成」完成 TTS，再到「4. 預覽匯出」按「打包課程預覽」。",
        { status: 404 },
      );
    }
  }

  const buf = await readFile(filePath);
  const ext = filePath.includes(".") ? filePath.slice(filePath.lastIndexOf(".")) : ".html";
  const type = MIME[ext] ?? "application/octet-stream";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
    },
  });
}
