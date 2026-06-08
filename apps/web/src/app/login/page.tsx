"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/BrandMark";
import { usePlaySoundOnError } from "@/hooks/usePlaySoundOnError";
import { formatAuthError } from "@/lib/format-auth-error";

const MISSING_EMAIL_MESSAGE = "請輸入您的帳號（電子郵件）";
const MISSING_PASSWORD_MESSAGE = "請輸入密碼";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  usePlaySoundOnError(error);

  async function handleAuth(mode: "signIn" | "signUp") {
    if (!email.trim()) {
      setError(MISSING_EMAIL_MESSAGE);
      return;
    }
    if (!password) {
      setError(MISSING_PASSWORD_MESSAGE);
      return;
    }
    const supabase = createClient();
    setLoading(true);
    setError("");
    const fn =
      mode === "signIn"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error: err } = await fn;
    setLoading(false);
    if (err) {
      setError(formatAuthError(err));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="cf-shell flex min-h-screen items-center justify-center p-6">
      <div className="cf-card cf-card-padded w-full max-w-md">
        <div className="mb-6 text-center">
          <BrandMark size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">CourseFlow 教學影片製作平台</h1>
          </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) void handleAuth("signIn");
          }}
        >
          <div>
            <label className="cf-label" htmlFor="email">
              帳號（電子郵件）
            </label>
            <input
              id="email"
              type="email"
              placeholder="例如：name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cf-input"
            />
          </div>
          <div>
            <label className="cf-label" htmlFor="password">
              密碼
            </label>
            <input
              id="password"
              type="password"
              placeholder="至少 6 個字元"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cf-input"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "處理中…" : "登入"}
            </Button>
            <Button
              type="button"
              className="flex-1"
              variant="secondary"
              disabled={loading}
              onClick={() => handleAuth("signUp")}
            >
              註冊
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
