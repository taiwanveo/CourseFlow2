"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/BrandMark";
import { SETTINGS_RETURN_KEY } from "@/lib/settings-return";

const PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Google Gemini" },
  { id: "openrouter", label: "OpenRouter" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [configured, setConfigured] = useState<string[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((d) => setConfigured((d.providers ?? []).map((p: { provider: string }) => p.provider)));
  }, []);

  const goBack = useCallback(() => {
    const stored =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(SETTINGS_RETURN_KEY)
        : null;
    if (stored && stored !== "/settings" && stored.startsWith("/")) {
      sessionStorage.removeItem(SETTINGS_RETURN_KEY);
      router.push(stored);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }, [router]);

  const save = async (provider: string) => {
    if (!keys[provider]?.trim()) {
      toast("請輸入 API Key", "error");
      return;
    }
    setSavingProvider(provider);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keys[provider] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "儲存失敗", "error");
        return;
      }
      setConfigured((c) => [...new Set([...c, provider])]);
      setKeys((prev) => ({ ...prev, [provider]: "" }));
      toast(`${PROVIDERS.find((p) => p.id === provider)?.label ?? provider} API Key 已儲存`, "success");
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="cf-shell">
      <header className="cf-topbar">
        <div className="cf-topbar-inner">
          <Link href="/dashboard" className="cf-brand">
            <BrandMark size="sm" />
            <span>CourseFlow</span>
          </Link>
        </div>
      </header>

      <main className="cf-page cf-page-narrow">
        <div className="mb-6">
          <button
            type="button"
            onClick={goBack}
            className="cf-btn cf-btn-secondary cf-btn-sm inline-flex"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            返回上一頁
          </button>
        </div>

        <div className="cf-page-header">
          <div>
            <h1 className="cf-page-title">設定</h1>
            <p className="cf-page-desc">
              API Key 僅存於伺服器（加密），用於 LLM 與 TTS。Edge-TTS 無需 Key。
            </p>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {PROVIDERS.map((p) => (
            <li key={p.id}>
              <div className="cf-card cf-card-padded">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="font-medium">{p.label}</span>
                  {configured.includes(p.id) ? (
                    <span className="cf-badge cf-badge-accent">已設定</span>
                  ) : null}
                </div>
                <input
                  type="password"
                  placeholder="貼上 API Key"
                  value={keys[p.id] ?? ""}
                  onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                  className="cf-input"
                />
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={savingProvider === p.id}
                  onClick={() => save(p.id)}
                >
                  {savingProvider === p.id ? "儲存中…" : "儲存"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
