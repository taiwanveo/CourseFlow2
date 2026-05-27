"use client";

import { useMemo, useState } from "react";
import {
  BANANAX_ATTRIBUTION_URL,
  type ImageStyleCatalogEntry,
} from "@/data/image-style-catalog";
import { useBananaxCatalog } from "@/hooks/useBananaxCatalog";

type FilterMode = "all" | "top" | "business";

export function ImageStylePickerModal({
  open,
  selectedId,
  disabled,
  onClose,
  onSelect,
}: {
  open: boolean;
  selectedId: string | null | undefined;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (entry: ImageStyleCatalogEntry) => void;
}) {
  const { styles, loading, error } = useBananaxCatalog();
  const [filter, setFilter] = useState<FilterMode>("top");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = styles;
    if (filter === "top") {
      list = list.filter((e) => (e.score ?? 0) >= 45);
    } else if (filter === "business") {
      list = list.filter((e) => e.id.startsWith("biz_"));
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.titleZh.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.titleEn?.toLowerCase().includes(q) ?? false) ||
        String(e.number ?? "").includes(q),
    );
  }, [styles, filter, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-style-picker-title"
      onClick={onClose}
    >
      <div
        className="cf-card flex max-h-[92vh] w-full max-w-5xl flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
          <h2 id="image-style-picker-title" className="text-lg font-semibold tracking-tight">
            選擇生圖風格主題（BananaX）
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            提示詞來自{" "}
            <a
              href={BANANAX_ATTRIBUTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline hover:opacity-90"
            >
              BananaX 資訊圖表評估
            </a>
            ；預覽圖已鏡像至本機伺服器，無需連線官網。點選卡片採用該風格中文提示詞；CourseFlow 會額外要求 16:9、且不渲染可讀文字。
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              placeholder="搜尋風格名稱或編號（如 Editorial、17）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="cf-input w-full flex-1 text-sm"
              disabled={disabled || loading}
            />
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["top", "高分精選"],
                  ["all", "全部"],
                  ["business", "商業風格"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={disabled || loading}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    filter === id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-zinc-500">載入 BananaX 風格目錄…</p>
          ) : error ? (
            <p className="py-12 text-center text-sm text-red-400">{error}</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-zinc-500">
                顯示 {filtered.length} / {styles.length} 種風格
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((entry) => {
                  const isSelected = selectedId === entry.id;
                  const isExpanded = expandedId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col overflow-hidden rounded-lg border transition-colors ${
                        isSelected
                          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                          : "border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        className="text-left disabled:opacity-50"
                        onClick={() => onSelect(entry)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="aspect-video w-full object-cover bg-zinc-900"
                        />
                        <div className="space-y-0.5 px-2 py-2">
                          <p className="line-clamp-2 text-xs font-medium text-zinc-200">
                            {entry.titleZh}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            #{entry.number ?? "—"}
                            {entry.score != null ? ` · ${entry.score}/50` : ""}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="border-t border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        {isExpanded ? "收合" : "預覽與提示詞"}
                      </button>
                      {isExpanded ? (
                        <div className="border-t border-zinc-800 bg-zinc-950/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entry.previewUrl}
                            alt=""
                            className="max-h-48 w-full object-contain bg-zinc-950"
                          />
                          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap px-2 py-2 text-[10px] leading-relaxed text-zinc-400">
                            {entry.stylePromptZh}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">沒有符合的風格</p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3 sm:px-5">
          <button type="button" className="cf-btn cf-btn-secondary cf-btn-sm" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
