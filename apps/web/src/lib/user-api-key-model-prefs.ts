const MODEL_PREF_COLUMN_NAMES = ["default_model", "text_model", "image_model"] as const;

type ErrorWithMessage = {
  message?: string | null;
};

export function isMissingModelPrefsColumnError(error: ErrorWithMessage | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  if (!message) return false;
  return (
    message.includes("schema cache") &&
    MODEL_PREF_COLUMN_NAMES.some((columnName) => message.includes(columnName))
  );
}

export const MODEL_PREFS_MIGRATION_HINT =
  "資料庫尚未套用模型偏好欄位 migration，請先執行 supabase/migrations/20260603000000_model_prefs.sql。";