/** job_runs 多久未更新視為僵死（無心跳／程序已掛） */
export function isStaleJob(
  updatedAt: string | null,
  createdAt: string | null,
  staleMs: number,
): boolean {
  const touched = updatedAt ?? createdAt;
  if (!touched) return false;
  const touchedTs = Date.parse(touched);
  if (!Number.isFinite(touchedTs)) return false;
  return Date.now() - touchedTs > staleMs;
}
