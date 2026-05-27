import type { ImageStyleCatalogEntry } from "@/data/image-style-catalog";
import type { WvpImageStyleSelection } from "@/lib/wvp-settings";

export function catalogEntryToSelection(
  entry: ImageStyleCatalogEntry,
): WvpImageStyleSelection {
  return {
    id: entry.id,
    titleZh: entry.titleZh,
    source: entry.source,
  };
}
