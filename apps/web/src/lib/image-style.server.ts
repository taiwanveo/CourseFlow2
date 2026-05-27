import "server-only";

import type { WvpImageStyleSelection } from "@/lib/wvp-settings";
import {
  getImageStyleById,
  getImageStylePromptZh,
  isValidBananaxStyleId,
} from "@/lib/bananax-catalog";

export function resolveImageStyleFragment(
  selection: WvpImageStyleSelection | null | undefined,
): string | undefined {
  return getImageStylePromptZh(selection?.id);
}

export function isValidImageStyleId(id: string): boolean {
  return isValidBananaxStyleId(id);
}

export { getImageStyleById };

