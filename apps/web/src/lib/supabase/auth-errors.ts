/** Supabase 回傳的過期／無效 refresh token，應視為未登入並清除 cookie。 */
export function isStaleRefreshError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "refresh_token_not_found" ||
    error.code === "invalid_refresh_token" ||
    error.message?.includes("Refresh Token") === true
  );
}
