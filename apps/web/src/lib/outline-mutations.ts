import type { CourseComposition } from "@courseflow/core";

export function stepsForChapter(composition: CourseComposition, chapterId: string) {
  return composition.steps
    .filter((s) => s.chapterId === chapterId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function siblingChapters(
  composition: CourseComposition,
  parentId: string | null,
) {
  return composition.chapters
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function applyChapterOrder(
  composition: CourseComposition,
  parentId: string | null,
  orderedIds: string[],
) {
  const sortMap = new Map(orderedIds.map((id, index) => [id, index]));
  return {
    ...composition,
    chapters: composition.chapters.map((chapter) =>
      chapter.parentId === parentId && sortMap.has(chapter.id)
        ? { ...chapter, sortOrder: sortMap.get(chapter.id)! }
        : chapter,
    ),
  };
}

function applyStepOrder(
  composition: CourseComposition,
  chapterId: string,
  orderedIds: string[],
) {
  const stepMap = new Map(composition.steps.map((step) => [step.id, step]));
  const reordered = orderedIds.map((id, index) => ({
    ...stepMap.get(id)!,
    chapterId,
    sortOrder: index,
  }));
  const reorderedIds = new Set(orderedIds);
  const others = composition.steps.filter((step) => !reorderedIds.has(step.id));
  return {
    ...composition,
    steps: [...others, ...reordered],
  };
}

export function reorderSiblingChapters(
  composition: CourseComposition,
  parentId: string | null,
  draggedId: string,
  targetId: string,
) {
  if (draggedId === targetId) return composition;
  const ids = siblingChapters(composition, parentId).map((chapter) => chapter.id);
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return composition;
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  return applyChapterOrder(composition, parentId, ids);
}

export function reorderStepsInChapter(
  composition: CourseComposition,
  chapterId: string,
  draggedId: string,
  targetId: string,
) {
  if (draggedId === targetId) return composition;
  const ids = stepsForChapter(composition, chapterId).map((step) => step.id);
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return composition;
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  return applyStepOrder(composition, chapterId, ids);
}

export function moveStepToChapter(
  composition: CourseComposition,
  stepId: string,
  targetChapterId: string,
  targetIndex?: number,
) {
  const step = composition.steps.find((item) => item.id === stepId);
  if (!step) return composition;

  const oldChapterId = step.chapterId;
  const oldIds = stepsForChapter(composition, oldChapterId)
    .map((item) => item.id)
    .filter((id) => id !== stepId);

  let next = applyStepOrder(composition, oldChapterId, oldIds);

  const targetIds = stepsForChapter(next, targetChapterId)
    .map((item) => item.id)
    .filter((id) => id !== stepId);
  const insertAt =
    targetIndex === undefined
      ? targetIds.length
      : Math.max(0, Math.min(targetIndex, targetIds.length));
  targetIds.splice(insertAt, 0, stepId);

  next = applyStepOrder(next, targetChapterId, targetIds);
  return next;
}

export function addChapter(composition: CourseComposition) {
  const chapterId = crypto.randomUUID();
  return {
    composition: {
      ...composition,
      chapters: [
        ...composition.chapters,
        {
          id: chapterId,
          parentId: null,
          title: "新章節",
          sortOrder: siblingChapters(composition, null).length,
        },
      ],
    },
    chapterId,
  };
}

export function addStep(composition: CourseComposition, chapterId: string) {
  const stepId = crypto.randomUUID();
  return {
    composition: {
      ...composition,
      steps: [
        ...composition.steps,
        {
          id: stepId,
          chapterId,
          sortOrder: stepsForChapter(composition, chapterId).length,
          script: "",
          screenContent: "新步驟",
          infoPool: [],
        },
      ],
    },
    stepId,
  };
}

function collectChapterTreeIds(composition: CourseComposition, chapterId: string): string[] {
  const ids = [chapterId];
  for (const child of siblingChapters(composition, chapterId)) {
    ids.push(...collectChapterTreeIds(composition, child.id));
  }
  return ids;
}

function pruneStepsFromComposition(
  composition: CourseComposition,
  stepIds: Set<string>,
): CourseComposition {
  return {
    ...composition,
    steps: composition.steps.filter((s) => !stepIds.has(s.id)),
    audio: composition.audio.filter((a) => !stepIds.has(a.stepId)),
    subtitles: composition.subtitles.filter((s) => !stepIds.has(s.stepId)),
    visuals: composition.visuals.filter((v) => !stepIds.has(v.stepId)),
    stepTts: composition.stepTts?.filter((t) => !stepIds.has(t.stepId)),
  };
}

export function deleteStep(
  composition: CourseComposition,
  stepId: string,
): { composition: CourseComposition; error?: string } {
  const step = composition.steps.find((s) => s.id === stepId);
  if (!step) return { composition };
  if (step.stepKind === "chapter") {
    return { composition, error: "章節分隔頁會隨章節一併刪除，請使用「刪除章節」" };
  }

  let next = pruneStepsFromComposition(composition, new Set([stepId]));
  const orderedIds = stepsForChapter(next, step.chapterId).map((s) => s.id);
  next = applyStepOrder(next, step.chapterId, orderedIds);
  return { composition: next };
}

export function deleteChapter(
  composition: CourseComposition,
  chapterId: string,
): { composition: CourseComposition; error?: string } {
  if (!composition.chapters.some((c) => c.id === chapterId)) {
    return { composition };
  }

  const chapterIds = collectChapterTreeIds(composition, chapterId);
  if (composition.chapters.length === chapterIds.length) {
    return { composition, error: "至少需要保留一個章節" };
  }

  const stepIds = new Set(
    composition.steps.filter((s) => chapterIds.includes(s.chapterId)).map((s) => s.id),
  );

  let next = pruneStepsFromComposition(composition, stepIds);
  next = {
    ...next,
    chapters: next.chapters.filter((c) => !chapterIds.includes(c.id)),
  };

  const parentId = composition.chapters.find((c) => c.id === chapterId)?.parentId ?? null;
  const siblingIds = siblingChapters(next, parentId).map((c) => c.id);
  next = applyChapterOrder(next, parentId, siblingIds);

  return { composition: next };
}
