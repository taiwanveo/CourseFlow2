import type { CourseComposition } from "@courseflow/core";
import { contentChaptersFromComposition } from "@/lib/wvp-chapters";
import { titleToWvpChapterId } from "@/lib/wvp-slug";

/** 文稿章節 id → WVP 章節資料夾 id（與 scaffold / 素材綁定一致） */
export function wvpChapterIdMap(composition: CourseComposition): Map<string, string> {
  const roots = contentChaptersFromComposition(composition);
  return new Map(roots.map((ch, i) => [ch.id, titleToWvpChapterId(ch.title, i)]));
}
