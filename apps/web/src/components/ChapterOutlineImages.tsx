"use client";

import { useCallback, useRef, useState } from "react";
import type { WvpAssetRef } from "@/lib/wvp-settings";
import { LottieMark } from "@/components/lottie/LottieMark";
import { HOOK_SLIDE_STEP_MAX } from "@/lib/wvp-hook-constants";

/** 樹狀大綱／Craft 章節列的配圖上傳（綁定 wvpChapterId） */
export function ChapterOutlineImages({
  projectId,
  wvpChapterId,
  assets,
  onAssetsChange,
  locked,
  variant = "default",
}: {
  projectId: string;
  wvpChapterId: string;
  assets: WvpAssetRef[];
  onAssetsChange: (next: WvpAssetRef[]) => void;
  locked: boolean;
  /** hook：多圖開場，最多 3 張，順序對應 slide 01–03 */
  variant?: "default" | "hook";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isHook = variant === "hook";
  const maxImages = isHook ? HOOK_SLIDE_STEP_MAX : undefined;

  const chapterAssets = assets.filter(
    (a) => a.url?.trim() && a.wvpChapterId === wvpChapterId,
  );
  const atMax = maxImages !== undefined && chapterAssets.length >= maxImages;
  const remainingSlots =
    maxImages !== undefined ? Math.max(0, maxImages - chapterAssets.length) : undefined;

  const replaceChapterAssets = useCallback(
    (nextForChapter: WvpAssetRef[]) => {
      const rest = assets.filter((a) => a.wvpChapterId !== wvpChapterId);
      onAssetsChange([...rest, ...nextForChapter]);
    },
    [assets, onAssetsChange, wvpChapterId],
  );

  const upload = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    const slice =
      remainingSlots !== undefined ? arr.slice(0, remainingSlots) : arr;
    if (!slice.length) {
      setErr(isHook ? `多圖開場最多 ${HOOK_SLIDE_STEP_MAX} 張，請先移除多餘圖片` : "已達上傳上限");
      return;
    }
    setUploading(true);
    setErr(null);
    const added: WvpAssetRef[] = [];
    const baseIndex = chapterAssets.length;
    try {
      for (let i = 0; i < slice.length; i++) {
        const file = slice[i]!;
        const form = new FormData();
        form.set("file", file);
        form.set("kind", "image");
        const res = await fetch(`/api/projects/${projectId}/upload-asset`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "上傳失敗");
        const slideStep = isHook ? baseIndex + i + 1 : undefined;
        added.push({
          url: data.publicUrl as string,
          alt: file.name.replace(/\.[^.]+$/, "").slice(0, 40),
          wvpChapterId,
          ...(slideStep !== undefined ? { step: slideStep } : {}),
        });
      }
      replaceChapterAssets([...chapterAssets, ...added]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上傳失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const uploadLabel = uploading
    ? "上傳中…"
    : isHook
      ? remainingSlots && remainingSlots > 0
        ? `+ 上傳開場圖（尚可 ${remainingSlots} 張）`
        : "+ 上傳開場圖"
      : "+ 章節配圖";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={locked || uploading || atMax}
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
          }}
        />
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-cf-accent)] hover:bg-white/8 disabled:opacity-50"
          disabled={locked || uploading || atMax}
          onClick={() => fileRef.current?.click()}
        >
          {uploadLabel}
        </button>
        {chapterAssets.length > 0 ? (
          <span className="text-[10px] text-zinc-600">
            {chapterAssets.length} 張
            {isHook ? `／${HOOK_SLIDE_STEP_MAX}` : ""}
          </span>
        ) : null}
      </div>
      {err ? <p className="text-[10px] text-amber-500/90">{err}</p> : null}
      {chapterAssets.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {chapterAssets.map((a, i) => (
            <li key={`${a.url}-${i}`} className="group relative">
              <div className="h-10 w-14 overflow-hidden rounded bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.alt ?? ""} className="h-full w-full object-cover" />
              </div>
              {isHook ? (
                <span className="mt-0.5 block text-center text-[9px] text-amber-200/70">
                  圖 {i + 1}
                </span>
              ) : null}
              {!locked ? (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-900 text-[9px] text-white group-hover:flex"
                  onClick={() => {
                    const next = chapterAssets
                      .filter((_, j) => j !== i)
                      .map((asset, j) =>
                        isHook ? { ...asset, step: j + 1 } : asset,
                      );
                    replaceChapterAssets(next);
                  }}
                  aria-label="移除圖片"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {uploading ? (
        <LottieMark variant="loading" size={14} ariaLabel="上傳中" className="inline-block" />
      ) : null}
    </div>
  );
}
