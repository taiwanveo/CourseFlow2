import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createWvpDistSignedUrl,
  ensureWvpDistLocal,
  readWvpDistIndexFromStorage,
  shouldServeWvpAssetsViaStorage,
} from "@/lib/wvp-dist-storage";
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
  ".gif": "image/gif",
  ".bmp": "image/bmp",
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

function relPathFromSegments(segments: string[] | undefined): string {
  return segments?.length ? segments.join("/") : "index.html";
}

/** 僅根路徑 index 為 SPA 入口；dist 內 animations/*.html 等為靜態資源 */
function isSpaIndexRequest(relPath: string): boolean {
  return relPath === "index.html";
}

function isDistStaticAsset(lastSeg: string, relPath: string): boolean {
  if (/\.html$/i.test(lastSeg)) {
    return !isSpaIndexRequest(relPath);
  }
  return /\.(mp3|wav|m4a|ogg|css|js|map|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|json|bmp)$/i.test(
    lastSeg,
  );
}

/** Vite 產物與媒體可快取；index.html 維持 no-cache 以便改版後能拿到新入口 */
function cacheControlForPath(relPath: string, isAsset: boolean): string {
  if (!isAsset || relPath === "index.html" || relPath.endsWith("/index.html")) {
    return "no-cache";
  }
  const name = relPath.slice(relPath.lastIndexOf("/") + 1);
  if (/\.(mp3|wav|m4a|ogg)$/i.test(name)) {
    return "private, max-age=86400";
  }
  if (/\.[a-f0-9]{8,}\.(js|css)$/i.test(name) || /\.(woff2?|png|jpe?g|webp|svg|gif|ico)$/i.test(name)) {
    return "private, max-age=604800, immutable";
  }
  if (/\.(js|css)$/i.test(name)) {
    return "private, max-age=3600";
  }
  return "private, max-age=600";
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

  const relPath = relPathFromSegments(segments);
  const lastSeg = segments?.length ? segments[segments.length - 1]! : "index.html";
  const isAsset = isDistStaticAsset(lastSeg, relPath);
  const isSpaEntry = isSpaIndexRequest(relPath);

  const useStorageCdn = shouldServeWvpAssetsViaStorage();

  if (isAsset && useStorageCdn) {
    const signedUrl = await createWvpDistSignedUrl(supabase, user.id, id, relPath);
    if (signedUrl) {
      return NextResponse.redirect(signedUrl, {
        status: 307,
        headers: {
          "Cache-Control": cacheControlForPath(relPath, true),
        },
      });
    }
  }

  if (isSpaEntry && useStorageCdn) {
    const indexBuf = await readWvpDistIndexFromStorage(supabase, user.id, id);
    if (indexBuf) {
      return new NextResponse(new Uint8Array(indexBuf), {
        headers: {
          "Content-Type": MIME[".html"]!,
          "Cache-Control": "no-cache",
        },
      });
    }
  }

  await ensureWvpDistLocal(supabase, user.id, id);

  const distRoot = presentationDistDir(id);
  let filePath = safeResolve(distRoot, segments ?? []);

  if (!filePath) return new NextResponse("Forbidden", { status: 403 });

  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    if (isAsset) {
      return new NextResponse("Not found", { status: 404 });
    }
    filePath = safeResolve(distRoot, []);
    if (!filePath) return new NextResponse("Not found", { status: 404 });
    try {
      buf = await readFile(filePath);
    } catch {
      return new NextResponse(
        "尚未建置 WVP 預覽。請在「3. 語音生成」完成 TTS，再到「4. 預覽匯出」按「打包課程預覽」。",
        { status: 404 },
      );
    }
  }

  const ext = filePath.includes(".") ? filePath.slice(filePath.lastIndexOf(".")) : ".html";
  const type = MIME[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": cacheControlForPath(relPath, isAsset),
    },
  });
}
