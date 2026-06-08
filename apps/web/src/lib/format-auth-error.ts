type AuthErrorLike = {
  message: string;
  code?: string;
};

const AUTH_ERROR_BY_CODE: Record<string, string> = {
  invalid_credentials: "請輸入正確的登入密碼",
  email_not_confirmed: "請先至信箱完成驗證後再登入",
  user_already_exists: "此電子郵件已註冊，請直接登入",
  email_exists: "此電子郵件已註冊，請直接登入",
  weak_password: "密碼強度不足，請使用至少 6 個字元",
  email_address_invalid: "電子郵件格式不正確",
  over_request_rate_limit: "嘗試次數過多，請稍後再試",
  over_email_send_rate_limit: "寄信次數過多，請稍後再試",
  signup_disabled: "目前暫停新帳號註冊，請聯絡管理員",
  user_not_found: "請輸入正確的登入密碼",
};

const AUTH_ERROR_BY_MESSAGE: Array<{ match: (msg: string) => boolean; text: string }> = [
  {
    match: (msg) => msg.includes("missing email or phone"),
    text: "請輸入您的帳號（電子郵件）",
  },
  {
    match: (msg) => msg.includes("invalid login credentials"),
    text: "請輸入正確的登入密碼",
  },
  {
    match: (msg) =>
      msg.includes("you must provide either an email or phone number and a password"),
    text: "請輸入帳號（電子郵件）與密碼",
  },
  {
    match: (msg) => msg.includes("email not confirmed"),
    text: "請先至信箱完成驗證後再登入",
  },
  {
    match: (msg) =>
      msg.includes("user already registered") || msg.includes("already been registered"),
    text: "此電子郵件已註冊，請直接登入",
  },
  {
    match: (msg) => msg.includes("password should be at least"),
    text: "密碼至少需要 6 個字元",
  },
  {
    match: (msg) => msg.includes("signup requires a valid password"),
    text: "請輸入有效密碼",
  },
  {
    match: (msg) =>
      msg.includes("unable to validate email address") || msg.includes("invalid format"),
    text: "電子郵件格式不正確",
  },
  {
    match: (msg) => msg.includes("rate limit"),
    text: "嘗試次數過多，請稍後再試",
  },
  {
    match: (msg) =>
      msg.includes("signups not allowed") || msg.includes("signup is disabled"),
    text: "目前暫停新帳號註冊，請聯絡管理員",
  },
  {
    match: (msg) => msg.includes("database error"),
    text: "系統暫時無法處理，請稍後再試",
  },
];

/** 將 Supabase Auth 英文錯誤轉為台灣使用者可讀的繁體中文。 */
export function formatAuthError(error: AuthErrorLike): string {
  if (error.code) {
    const byCode = AUTH_ERROR_BY_CODE[error.code];
    if (byCode) return byCode;
  }

  const normalized = error.message.trim().toLowerCase();
  for (const entry of AUTH_ERROR_BY_MESSAGE) {
    if (entry.match(normalized)) return entry.text;
  }

  return error.message;
}
