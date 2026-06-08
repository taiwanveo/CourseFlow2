import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const THEME_ID_RE = /^[a-z0-9-]+$/;

/** 伺服器程序內快取（同一容器重複請求零磁碟 I/O） */
const bufferCache = new Map<string, Buffer>();

function galleryDirs(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, "apps/web/public/assets/theme-gallery"),
    join(cwd, "public/assets/theme-gallery"),
  ];
}

async function readThemeWebp(themeId: string): Promise<Buffer | null> {
  const cached = bufferCache.get(themeId);
  if (cached) return cached;

  const fileName = `${themeId}.webp`;
  for (const dir of galleryDirs()) {
    try {
      const buf = await readFile(join(dir, fileName));
      bufferCache.set(themeId, buf);
      return buf;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ themeId: string }> },
) {
  const { themeId } = await params;
  if (!THEME_ID_RE.test(themeId)) {
    return NextResponse.json({ error: "無效的主題 ID" }, { status: 400 });
  }

  const buf = await readThemeWebp(themeId);
  if (!buf) {
    return NextResponse.json({ error: "找不到主題預覽圖" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buf.length),
    },
  });
}
