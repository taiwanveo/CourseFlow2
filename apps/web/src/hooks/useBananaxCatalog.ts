"use client";

import { useEffect, useState } from "react";
import { usePlaySoundOnError } from "@/hooks/usePlaySoundOnError";
import {
  BANANAX_CATALOG_URL,
  type BananaxCatalogFile,
  type ImageStyleCatalogEntry,
} from "@/data/image-style-catalog";

let clientCache: BananaxCatalogFile | null = null;
let clientPromise: Promise<BananaxCatalogFile> | null = null;

export function fetchBananaxCatalog(): Promise<BananaxCatalogFile> {
  if (clientCache) return Promise.resolve(clientCache);
  if (!clientPromise) {
    clientPromise = fetch(BANANAX_CATALOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error("無法載入 BananaX 風格目錄");
        return r.json() as Promise<BananaxCatalogFile>;
      })
      .then((data) => {
        clientCache = data;
        return data;
      });
  }
  return clientPromise;
}

export function useBananaxCatalog() {
  const [catalog, setCatalog] = useState<BananaxCatalogFile | null>(clientCache);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!clientCache);

  usePlaySoundOnError(error);

  useEffect(() => {
    if (clientCache) {
      setCatalog(clientCache);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchBananaxCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "載入失敗");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, styles: catalog?.styles ?? ([] as ImageStyleCatalogEntry[]), loading, error };
}
