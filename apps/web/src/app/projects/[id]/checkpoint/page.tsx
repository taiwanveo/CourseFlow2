import { redirect } from "next/navigation";

/** 計畫對齊已併入文稿內容與視覺動效；保留路徑導向視覺動效 */
export default async function CheckpointRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/craft`);
}
