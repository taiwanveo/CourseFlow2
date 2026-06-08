import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  createWvpDistSignedUrl,
  ensureWvpDistLocal,
  readWvpDistIndexFromStorage,
  shouldServeWvpAssetsViaStorage,
} from "@/lib/wvp-dist-storage";
import { presentationDistDir } from "@/lib/wvp-workdir";

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

export function relPathFromEmbedSegments(segments: string[] | undefined): string {
  return segments?.length ? segments.join("/") : "index.html";
}

function isSpaIndexRequest(relPath: string): boolean {
  return relPath === "index.html";
}

function isEmbedAnimationHtml(relPath: string): boolean {
  return /^animations\/[^/]+\/\d{2}\.html$/i.test(relPath);
}

function isDistStaticAsset(lastSeg: string, relPath: string): boolean {
  if (/\.html$/i.test(lastSeg)) return !isSpaIndexRequest(relPath);
  return /\.(mp3|wav|m4a|ogg|css|js|map|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|json|bmp)$/i.test(
    lastSeg,
  );
}

function cacheControlForPath(relPath: string, isAsset: boolean): string {
  if (!isAsset || relPath === "index.html" || relPath.endsWith("/index.html")) {
    return "no-cache";
  }
  const name = relPath.slice(relPath.lastIndexOf("/") + 1);
  if (/\.(mp3|wav|m4a|ogg)$/i.test(name)) return "private, max-age=86400";
  if (/\.[a-f0-9]{8,}\.(js|css)$/i.test(name) || /\.(woff2?|png|jpe?g|webp|svg|gif|ico)$/i.test(name)) {
    return "private, max-age=604800, immutable";
  }
  if (/\.(js|css)$/i.test(name)) return "private, max-age=3600";
  return "private, max-age=600";
}

/** 共用：依 userId + projectId 提供 WVP dist 靜態檔 */
export async function serveWvpEmbedAsset(opts: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  segments: string[] | undefined;
}): Promise<NextResponse> {
  const { supabase, userId, projectId, segments } = opts;
  const relPath = relPathFromEmbedSegments(segments);
  const lastSeg = segments?.length ? segments[segments.length - 1]! : "index.html";
  const isAsset = isDistStaticAsset(lastSeg, relPath);
  const isSpaEntry = isSpaIndexRequest(relPath);
  const useStorageCdn = shouldServeWvpAssetsViaStorage();

  if (isAsset && useStorageCdn && !isEmbedAnimationHtml(relPath)) {
    const signedUrl = await createWvpDistSignedUrl(supabase, userId, projectId, relPath);
    if (signedUrl) {
      return NextResponse.redirect(signedUrl, {
        status: 307,
        headers: { "Cache-Control": cacheControlForPath(relPath, true) },
      });
    }
  }

  if (isSpaEntry && useStorageCdn) {
    const indexBuf = await readWvpDistIndexFromStorage(supabase, userId, projectId);
    if (indexBuf) {
      return new NextResponse(new Uint8Array(indexBuf), {
        headers: {
          "Content-Type": MIME[".html"]!,
          "Cache-Control": "no-cache",
        },
      });
    }
  }

  await ensureWvpDistLocal(supabase, userId, projectId);

  const distRoot = presentationDistDir(projectId);
  let filePath = safeResolve(distRoot, segments ?? []);

  if (!filePath) return new NextResponse("Forbidden", { status: 403 });

  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    if (isAsset) return new NextResponse("Not found", { status: 404 });
    filePath = safeResolve(distRoot, []);
    if (!filePath) return new NextResponse("Not found", { status: 404 });
    try {
      buf = await readFile(filePath);
    } catch {
      return new NextResponse("尚未建置課程預覽", { status: 404 });
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
