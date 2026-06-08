import { NextResponse } from "next/server";
import { listThemes, recommendThemes, resolveThemeMotion } from "@courseflow/wvp-bridge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const all = listThemes();

  const themes = all.map((meta) => {
    const motion = resolveThemeMotion(meta.id, meta.mood);
    return {
      id: meta.id,
      name: meta.name,
      nameZh: meta.nameZh,
      description: meta.description,
      descriptionZh: meta.descriptionZh,
      mood: meta.mood,
      bestFor: meta.bestFor,
      preview: meta.preview,
      enterAnimationId: motion.enterAnimationId,
      transitionId: motion.transitionId,
    };
  });

  if (q) {
    const keywords = q.split(/\s+/).filter(Boolean);
    const recommended = recommendThemes(keywords, 5);
    return NextResponse.json({
      themes: recommended.map((meta) => themes.find((t) => t.id === meta.id)).filter(Boolean),
      all: themes.map((t) => ({
        id: t.id,
        nameZh: t.nameZh,
        descriptionZh: t.descriptionZh,
      })),
    });
  }

  return NextResponse.json({ themes });
}
