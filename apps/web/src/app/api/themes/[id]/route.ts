import { NextResponse } from "next/server";
import {
  buildThemeEditorPreviewCss,
  getThemeBundle,
  listThemes,
  resolveThemeMotion,
} from "@courseflow/wvp-bridge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meta = listThemes().find((t) => t.id === id);
  if (!meta) return NextResponse.json({ error: "找不到主題" }, { status: 404 });

  const bundle = getThemeBundle(meta);
  if (!bundle) return NextResponse.json({ error: "主題資源不完整" }, { status: 404 });

  const motion = resolveThemeMotion(meta.id, meta.mood);

  return NextResponse.json({
    id: meta.id,
    nameZh: meta.nameZh,
    preview: meta.preview,
    resolved: bundle.resolved,
    enterAnimationId: motion.enterAnimationId,
    transitionId: motion.transitionId,
    editorPreviewCss: buildThemeEditorPreviewCss(meta.id),
    stylesCss: bundle.stylesCss,
  });
}
