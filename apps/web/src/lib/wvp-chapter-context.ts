import type { CourseComposition } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";

/** 本章文稿摘錄：供 AI 畫面與口播對齊（雙源） */
export function chapterContextForCraft(
  composition: CourseComposition | null,
  chapterId: string | undefined,
  articleRaw: string,
  chapterTitle: string,
): string {
  if (!composition || !chapterId) {
    return articleRaw.slice(0, 4000);
  }

  const steps = composition.steps
    .filter((s) => s.chapterId === chapterId && !isChapterStep(s))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const fromSteps = steps
    .map((s, i) => {
      const screen = s.screenContent?.trim();
      const script = s.script?.trim();
      const parts = [
        screen ? `【畫面 ${i + 1}】${screen}` : "",
        script ? `【口播 ${i + 1}】${script}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  if (fromSteps.length > 200) {
    return `章節：${chapterTitle}\n\n${fromSteps}`.slice(0, 6000);
  }

  const ch = composition.chapters.find((c) => c.id === chapterId);
  const title = ch?.title ?? chapterTitle;
  const idx = articleRaw.indexOf(title);
  if (idx >= 0) {
    return articleRaw.slice(idx, idx + 3500);
  }
  return articleRaw.slice(0, 4000);
}
