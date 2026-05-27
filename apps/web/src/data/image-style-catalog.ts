/** BananaX 官網風格目錄型別（資料來自 public/data/bananax-zh-catalog.json） */

export const BANANAX_ATTRIBUTION_URL =
  "https://furoku.github.io/bananaX/projects/infographic-evaluation/zh/";

export const BANANAX_CATALOG_URL = "/data/bananax-zh-catalog.json";

export type ImageStyleCatalogEntry = {
  id: string;
  number: number | null;
  titleZh: string;
  titleEn: string | null;
  score: number | null;
  tags: string[];
  thumbnailUrl: string;
  previewUrl: string;
  stylePromptZh: string;
  source: "bananax-infographic-evaluation";
  catalogSource?: string;
};

export type BananaxCatalogFile = {
  meta: {
    attributionUrl: string;
    /** 本機 public 路徑前綴 */
    assetsLocalBase: string;
    /** BananaX 官網（僅供署名／更新腳本參考） */
    remoteAssetBase?: string;
    /** @deprecated 舊版欄位 */
    assetBase?: string;
    generatedAt: string;
    count: number;
    note: string;
  };
  styles: ImageStyleCatalogEntry[];
};
