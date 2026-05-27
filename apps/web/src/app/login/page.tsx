"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/BrandMark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAuth(mode: "signIn" | "signUp") {
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
      setError(err.message);
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
        <div className="space-y-4">
          <div>
            <label className="cf-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
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
            <Button className="flex-1" disabled={loading} onClick={() => handleAuth("signIn")}>
              {loading ? "處理中…" : "登入"}
            </Button>
            <Button className="flex-1" variant="secondary" disabled={loading} onClick={() => handleAuth("signUp")}>
              註冊
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
