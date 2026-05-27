import type { WvpAssetRef } from "@/lib/wvp-settings";
import { writePresentationIllustrationFiles } from "@courseflow/presentation";
import { presentationDirForProject } from "@/lib/wvp-workdir";

/** 將 Checkpoint 上傳圖下載到 presentation/public/images/，供預覽與 AI 生圖路徑共用 */
export async function syncCheckpointAssetsToPresentation(
  projectId: string,
  assets: WvpAssetRef[] | undefined,
): Promise<number> {
  if (!assets?.length) return 0;
  const presentationDir = presentationDirForProject(projectId);
  const files: { wvpChapterId: string; stepIndex: number; buffer: Buffer }[] = [];

  for (const asset of assets) {
    const url = asset.url?.trim();
    const chapterId = asset.wvpChapterId?.trim();
    if (!url || !chapterId) continue;

    const stepIndex = typeof asset.step === "number" ? asset.step : 0;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[wvp] Checkpoint 圖下載失敗 ${res.status}: ${url.slice(0, 80)}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) continue;
      files.push({ wvpChapterId: chapterId, stepIndex, buffer: buf });
    } catch (e) {
      console.warn(`[wvp] Checkpoint 圖下載失敗:`, (e as Error).message);
    }
  }

  return writePresentationIllustrationFiles(presentationDir, files);
}
