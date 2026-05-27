"use client";

import { useCallback, useRef, useState } from "react";
import type { WvpAssetRef } from "@/lib/wvp-settings";
import { LottieMark } from "@/components/lottie/LottieMark";

/** 樹狀大綱單一章節的配圖上傳（綁定 wvpChapterId） */
export function ChapterOutlineImages({
  projectId,
  wvpChapterId,
  assets,
  onAssetsChange,
  locked,
}: {
  projectId: string;
  wvpChapterId: string;
  assets: WvpAssetRef[];
  onAssetsChange: (next: WvpAssetRef[]) => void;
  locked: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chapterAssets = assets.filter(
    (a) => a.url?.trim() && a.wvpChapterId === wvpChapterId,
  );

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
    setUploading(true);
    setErr(null);
    const added: WvpAssetRef[] = [];
    try {
      for (const file of arr) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", "image");
        const res = await fetch(`/api/projects/${projectId}/upload-asset`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "上傳失敗");
        added.push({
          url: data.publicUrl as string,
          alt: file.name.replace(/\.[^.]+$/, "").slice(0, 40),
          wvpChapterId,
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

  return (
    <div
      className="mt-1 space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5"
      style={{ marginLeft: "0.25rem" }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={locked || uploading}
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
          }}
        />
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-cf-accent)] hover:bg-white/8 disabled:opacity-50"
          disabled={locked || uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "上傳中…" : "+ 章節配圖"}
        </button>
        {chapterAssets.length > 0 ? (
          <span className="text-[10px] text-zinc-600">{chapterAssets.length} 張</span>
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
              {!locked ? (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-900 text-[9px] text-white group-hover:flex"
                  onClick={() =>
                    replaceChapterAssets(chapterAssets.filter((_, j) => j !== i))
                  }
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
