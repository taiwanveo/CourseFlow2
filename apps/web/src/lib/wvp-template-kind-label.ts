/** 打包 templateKind → 視覺動效階段顯示用中文標籤 */
const TEMPLATE_KIND_LABEL: Record<string, string> = {
  "list-reveal": "清單揭示",
  flow: "流程圖",
  hook: "多圖開場",
  magazine: "雜誌",
  "beat-scene": "節拍全屏",
  "visual-mix": "視覺混合",
};

export type CraftChecklistResult = {
  chapterSource?: { source?: string; templateKind?: string };
  appliedTemplate?: string;
};

export function resolveCraftTemplateKind(
  checklist: CraftChecklistResult | null | undefined,
): string | null {
  if (!checklist) return null;
  const kind =
    checklist.chapterSource?.templateKind?.trim() ??
    checklist.appliedTemplate?.trim();
  return kind || null;
}

export function templateKindDisplayLabel(kind: string): string {
  return TEMPLATE_KIND_LABEL[kind] ?? kind;
}
