import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BananaxCatalogFile, ImageStyleCatalogEntry } from "@/data/image-style-catalog";

const CATALOG_REL = join("public", "data", "bananax-zh-catalog.json");

let cached: BananaxCatalogFile | null = null;
let byId: Map<string, ImageStyleCatalogEntry> | null = null;

function catalogPath(): string {
  return join(process.cwd(), CATALOG_REL);
}

export function loadBananaxCatalog(): BananaxCatalogFile {
  if (cached) return cached;
  const raw = readFileSync(catalogPath(), "utf8");
  cached = JSON.parse(raw) as BananaxCatalogFile;
  return cached;
}

export function getBananaxStyles(): ImageStyleCatalogEntry[] {
  return loadBananaxCatalog().styles;
}

function styleMap(): Map<string, ImageStyleCatalogEntry> {
  if (!byId) {
    byId = new Map(getBananaxStyles().map((s) => [s.id, s]));
  }
  return byId;
}

export function getImageStyleById(id: string): ImageStyleCatalogEntry | undefined {
  return styleMap().get(id);
}

export function getImageStylePromptZh(styleId: string | undefined | null): string | undefined {
  if (!styleId) return undefined;
  return getImageStyleById(styleId)?.stylePromptZh;
}

export function isValidBananaxStyleId(id: string): boolean {
  return styleMap().has(id);
}

/** 清除快取（測試用） */
export function resetBananaxCatalogCache(): void {
  cached = null;
  byId = null;
}
