import { runChapterCraftChecklist } from "@courseflow/presentation";

/** Supabase jsonb 有時會以字串回傳，需先正規化再讀取 */
export function normalizeChecklistResult(
  raw: unknown,
): CraftRow["checklist_result"] {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return normalizeChecklistResult(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as CraftRow["checklist_result"];
  return null;
}

export function isChecklistSkipped(raw: unknown): boolean {
  return normalizeChecklistResult(raw)?.checklistSkipped === true;
}

type CraftRow = {
  wvp_chapter_id?: string;
  title: string;
  craft_status: string;
  checklist_result?: {
    checklistSkipped?: boolean;
    checklistSkippedAt?: string;
    narrations?: string[];
    chapterSource?: {
      chapterTsx?: string;
      chapterCss?: string;
      source?: string;
      templateKind?: string;
    };
    craftChecklist?: { passed?: boolean; items?: { id: string; passed: boolean; label: string }[] };
    aiPlan?: unknown;
  } | null;
};

export type ChapterExportIssue = {
  wvpChapterId?: string;
  title: string;
  craftStatus: string;
  checklistOk: boolean;
  checklistSkipped: boolean;
  failedItems: string[];
};

/** 以最新自檢規則重算（優先使用已存的 chapterSource，避免舊 checklist 誤擋匯出） */
export function evaluateChapterExportIssue(c: CraftRow): ChapterExportIssue {
  const checklistResult = normalizeChecklistResult(c.checklist_result);
  const base = {
    wvpChapterId: c.wvp_chapter_id,
    title: c.title,
    craftStatus: c.craft_status,
  };

  if (isChecklistSkipped(checklistResult)) {
    return {
      ...base,
      checklistOk: true,
      checklistSkipped: true,
      failedItems: [],
    };
  }

  if (c.craft_status === "approved") {
    return {
      ...base,
      checklistOk: true,
      checklistSkipped: false,
      failedItems: [],
    };
  }

  const prev = checklistResult;
  const src = prev?.chapterSource;
  const narrations = prev?.narrations ?? [];

  if (src?.chapterTsx && narrations.length > 0) {
    const live = runChapterCraftChecklist({
      wvpChapterId: "eval",
      tsx: src.chapterTsx,
      css: src.chapterCss ?? "",
      narrations,
      templateKind: src.templateKind,
    });
    return {
      ...base,
      checklistOk: live.passed,
      checklistSkipped: false,
      failedItems: live.items.filter((i) => !i.passed).map((i) => i.label),
    };
  }

  const cl = prev?.craftChecklist;
  const checklistOk = cl?.passed === true;
  return {
    ...base,
    checklistOk,
    checklistSkipped: false,
    failedItems:
      cl?.items?.filter((i) => !i.passed).map((i) => i.label) ?? [],
  };
}

export function evaluateProjectExportReadiness(opts: {
  chapters: CraftRow[];
  anchorOk: boolean;
  built: boolean;
  audioReady?: boolean;
  audioMessage?: string | null;
}): {
  ready: boolean;
  anchorOk: boolean;
  allChecklistOk: boolean;
  built: boolean;
  blockers: string[];
  chapters: ChapterExportIssue[];
} {
  const chapterIssues = opts.chapters.map(evaluateChapterExportIssue);
  const allChecklistOk =
    opts.chapters.length > 0 && chapterIssues.every((x) => x.checklistOk);

  const blockers: string[] = [];
  if (!opts.anchorOk) blockers.push("請先驗收第 1 章風格錨點");
  if (!allChecklistOk) {
    const bad = chapterIssues.filter((x) => !x.checklistOk);
    const names = bad.map((x) => `「${x.title}」`).join("、");
    const detail = bad
      .flatMap((x) => x.failedItems.slice(0, 2))
      .filter(Boolean)
      .slice(0, 3)
      .join("；");
    blockers.push(
      detail
        ? `部分章節未通過視覺自檢：${names}（${detail}）`
        : `部分章節未通過視覺自檢：${names}，請在視覺動效重做 ②③`,
    );
  }
  if (opts.audioReady === false && opts.audioMessage) {
    blockers.push(opts.audioMessage);
  }
  if (!opts.built) blockers.push("請先在「3. 語音生成」完成 TTS，再到「4. 預覽匯出」按「打包課程預覽」");

  return {
    ready:
      opts.anchorOk &&
      allChecklistOk &&
      opts.built &&
      (opts.audioReady !== false),
    anchorOk: opts.anchorOk,
    allChecklistOk,
    built: opts.built,
    blockers,
    chapters: chapterIssues,
  };
}
