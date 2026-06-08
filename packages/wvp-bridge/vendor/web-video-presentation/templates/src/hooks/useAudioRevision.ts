import { useEffect, useState } from "react";

/** 讀取 audio-revision.json，供 WVP 本地 mp3 快取破壞。 */
export function useAudioRevision(): string {
  const [revision, setRevision] = useState("");

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    let cancelled = false;
    void fetch(`${base}audio-revision.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { revision?: string } | null) => {
        if (!cancelled && data?.revision) setRevision(String(data.revision));
      })
      .catch(() => {
        /* 舊版預覽無 revision 檔時略過 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return revision;
}
