import { redirect } from "next/navigation";

/** 匯出已改為 PhaseNav / 播放頁的「匯出」按鈕，此路由保留相容舊連結 */
export default async function ExportPageRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/visual`);
}
