"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/BrandMark";
import { SETTINGS_RETURN_KEY } from "@/lib/settings-return";

const PROVIDERS = [
  { id: "openai",     label: "OpenAI" },
  { id: "gemini",     label: "Google Gemini" },
  { id: "openrouter", label: "OpenRouter" },
];

interface ProviderInfo {
  provider: string;
  configured: boolean;
  updatedAt?: string;
  defaultModel: string | null;
  textModel: string | null;
  imageModel: string | null;
}

interface ModelEntry { id: string; name: string }
interface ModelList  { text: ModelEntry[]; image: ModelEntry[] }

interface ModelPrefs {
  defaultModel: string;
  textModel: string;
  imageModel: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [providerInfos,    setProviderInfos]    = useState<ProviderInfo[]>([]);
  const [keys,             setKeys]             = useState<Record<string, string>>({});
  const [savingProvider,   setSavingProvider]   = useState<string | null>(null);
  const [modelLists,       setModelLists]       = useState<Record<string, ModelList | null>>({});
  const [loadingModels,    setLoadingModels]    = useState<Record<string, boolean>>({});
  const [modelListErrors,  setModelListErrors]  = useState<Record<string, string>>({});
  const [modelPrefs,       setModelPrefs]       = useState<Record<string, ModelPrefs>>({});
  const [savingModelPrefs, setSavingModelPrefs] = useState<string | null>(null);

  // ── 初始載入 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((d) => {
        const infos: ProviderInfo[] = d.providers ?? [];
        setProviderInfos(infos);
        const prefs: Record<string, ModelPrefs> = {};
        for (const p of infos) {
          prefs[p.provider] = {
            defaultModel: p.defaultModel ?? "",
            textModel:    p.textModel    ?? "",
            imageModel:   p.imageModel   ?? "",
          };
        }
        setModelPrefs(prefs);
      });
  }, []);

  const configured = providerInfos.filter((p) => p.configured).map((p) => p.provider);

  // ── 返回上一頁 ────────────────────────────────────────────────────────────
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

  // ── 儲存 API Key ──────────────────────────────────────────────────────────
  const saveKey = async (provider: string) => {
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
      setProviderInfos((prev) => {
        const exists = prev.find((p) => p.provider === provider);
        if (exists) return prev.map((p) => p.provider === provider ? { ...p, configured: true } : p);
        return [...prev, { provider, configured: true, defaultModel: null, textModel: null, imageModel: null }];
      });
      setKeys((prev) => ({ ...prev, [provider]: "" }));
      toast(
        `${PROVIDERS.find((p) => p.id === provider)?.label ?? provider} API Key 已儲存`,
        "success",
      );
    } finally {
      setSavingProvider(null);
    }
  };

  // ── 載入模型清單 ──────────────────────────────────────────────────────────
  const loadModels = async (provider: string) => {
    setLoadingModels((prev) => ({ ...prev, [provider]: true }));
    setModelListErrors((prev) => ({ ...prev, [provider]: "" }));
    try {
      const res = await fetch(`/api/settings/models/list?provider=${provider}`);
      const data = await res.json();
      if (!res.ok) {
        setModelListErrors((prev) => ({ ...prev, [provider]: data.error ?? "載入失敗" }));
        setModelLists((prev) => ({ ...prev, [provider]: null }));
        return;
      }
      const list = data as ModelList;
      setModelLists((prev) => ({ ...prev, [provider]: list }));
      // 若尚未設定 defaultModel，自動選第一個文字模型
      setModelPrefs((prev) => {
        const cur = prev[provider] ?? { defaultModel: "", textModel: "", imageModel: "" };
        if (!cur.defaultModel && list.text[0]) {
          return { ...prev, [provider]: { ...cur, defaultModel: list.text[0].id } };
        }
        return prev;
      });
    } finally {
      setLoadingModels((prev) => ({ ...prev, [provider]: false }));
    }
  };

  // ── 儲存模型設定 ──────────────────────────────────────────────────────────
  const saveModelPrefsForProvider = async (provider: string) => {
    const prefs = modelPrefs[provider];
    if (!prefs?.defaultModel?.trim()) {
      toast("請先選擇預設模型", "error");
      return;
    }
    setSavingModelPrefs(provider);
    try {
      const res = await fetch("/api/settings/model-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          defaultModel: prefs.defaultModel,
          textModel:    prefs.textModel  || undefined,
          imageModel:   prefs.imageModel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "儲存失敗", "error");
        return;
      }
      setProviderInfos((prev) =>
        prev.map((p) =>
          p.provider === provider
            ? {
                ...p,
                defaultModel: prefs.defaultModel || null,
                textModel:    prefs.textModel  || null,
                imageModel:   prefs.imageModel || null,
              }
            : p,
        ),
      );
      toast("模型設定已儲存", "success");
    } finally {
      setSavingModelPrefs(null);
    }
  };

  const updatePref = (provider: string, field: keyof ModelPrefs, value: string) => {
    setModelPrefs((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] ?? { defaultModel: "", textModel: "", imageModel: "" }), [field]: value },
    }));
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
              API Key 僅存於伺服器（加密）。設定 Key 後可進一步選擇各任務使用的模型。
            </p>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {PROVIDERS.map((p) => {
            const isConfigured = configured.includes(p.id);
            const list         = modelLists[p.id];
            const loading      = loadingModels[p.id] ?? false;
            const listError    = modelListErrors[p.id] ?? "";
            const prefs        = modelPrefs[p.id] ?? { defaultModel: "", textModel: "", imageModel: "" };

            return (
              <li key={p.id}>
                <div className="cf-card cf-card-padded flex flex-col gap-4">
                  {/* ── API Key 區塊 ───────────────────────────────── */}
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="font-medium">{p.label}</span>
                      {isConfigured && (
                        <span className="cf-badge cf-badge-accent">已設定</span>
                      )}
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
                      onClick={() => saveKey(p.id)}
                    >
                      {savingProvider === p.id ? "儲存中…" : "儲存 API Key"}
                    </Button>
                  </div>

                  {/* ── 模型選擇區塊（僅已設定時顯示） ──────────── */}
                  {isConfigured && (
                    <div className="border-t border-[var(--cf-border)] pt-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--cf-text2)]">
                          模型設定
                        </span>
                        <button
                          type="button"
                          className="cf-btn cf-btn-secondary cf-btn-sm inline-flex items-center gap-1.5"
                          disabled={loading}
                          onClick={() => loadModels(p.id)}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
                          {list ? "重新整理清單" : "載入模型清單"}
                        </button>
                      </div>

                      {listError && (
                        <p className="mb-3 text-sm text-red-500">{listError}</p>
                      )}

                      {list && (
                        <div className="flex flex-col gap-3">
                          {/* 預設模型（必填） */}
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--cf-text-mute)]">
                              預設模型 <span className="text-red-400">*</span>
                              <span className="ml-1 opacity-70">— 文字/圖片任務的後備模型</span>
                            </span>
                            <select
                              className="cf-input"
                              value={prefs.defaultModel}
                              onChange={(e) => updatePref(p.id, "defaultModel", e.target.value)}
                            >
                              <option value="">— 請選擇 —</option>
                              {list.text.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </label>

                          {/* 文字生成模型（選填） */}
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--cf-text-mute)]">
                              文字生成模型
                              <span className="ml-1 opacity-70">— 課程內容、章節、動畫生成（選填）</span>
                            </span>
                            <select
                              className="cf-input"
                              value={prefs.textModel}
                              onChange={(e) => updatePref(p.id, "textModel", e.target.value)}
                            >
                              <option value="">（使用預設模型）</option>
                              {list.text.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </label>

                          {/* 圖片生成模型（選填，Gemini 無此選項） */}
                          {list.image.length > 0 && (
                            <label className="flex flex-col gap-1">
                              <span className="text-xs text-[var(--cf-text-mute)]">
                                圖片生成模型
                                <span className="ml-1 opacity-70">— AI 配圖生成（選填）</span>
                              </span>
                              <select
                                className="cf-input"
                                value={prefs.imageModel}
                                onChange={(e) => updatePref(p.id, "imageModel", e.target.value)}
                              >
                                <option value="">（使用預設模型）</option>
                                {list.image.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </label>
                          )}

                          <Button
                            size="sm"
                            className="self-start"
                            disabled={savingModelPrefs === p.id || !prefs.defaultModel}
                            onClick={() => saveModelPrefsForProvider(p.id)}
                          >
                            {savingModelPrefs === p.id ? "儲存中…" : "儲存模型設定"}
                          </Button>
                        </div>
                      )}

                      {/* 已儲存的模型摘要（模型清單未載入時顯示） */}
                      {!list && !loading && (
                        <div className="text-sm text-[var(--cf-text-mute)]">
                          {providerInfos.find((pi) => pi.provider === p.id)?.defaultModel ? (
                            <span>
                              已選模型：
                              <span className="font-mono text-[var(--cf-text)]">
                                {providerInfos.find((pi) => pi.provider === p.id)?.defaultModel}
                              </span>
                            </span>
                          ) : (
                            <span>點擊「載入模型清單」以選擇模型</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
