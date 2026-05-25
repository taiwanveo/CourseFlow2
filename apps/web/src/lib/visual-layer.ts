import type { VisualElement } from "@courseflow/core";

export type LayerAction = "front" | "forward" | "backward" | "back";

export function reorderElementLayer(
  elements: VisualElement[],
  elementId: string,
  action: LayerAction,
): VisualElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const index = sorted.findIndex((el) => el.id === elementId);
  if (index < 0) return elements;

  const item = sorted[index]!;
  sorted.splice(index, 1);

  let target = index;
  if (action === "front") target = sorted.length;
  else if (action === "back") target = 0;
  else if (action === "forward") target = Math.min(sorted.length, index + 1);
  else if (action === "backward") target = Math.max(0, index - 1);

  sorted.splice(target, 0, item);
  return sorted.map((el, zIndex) => ({ ...el, zIndex }));
}

export function nextZIndex(elements: VisualElement[]): number {
  if (elements.length === 0) return 1;
  return Math.max(...elements.map((el) => el.zIndex)) + 1;
}
