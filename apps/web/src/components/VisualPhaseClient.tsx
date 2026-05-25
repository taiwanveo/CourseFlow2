"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import dynamic from "next/dynamic";

import type { CourseComposition } from "@courseflow/core";

import type { PhaseLocks } from "@courseflow/core";

import { PhaseBottomActions, ProjectPhaseNav } from "@/components/ProjectPhaseNav";

import { useToast } from "@/components/Toast";

import {

  applyThemeToComposition,

  type ClientThemeOption,

} from "@/lib/apply-theme";



const VisualEditorCanvas = dynamic(

  () => import("@/components/VisualEditorCanvas").then((m) => m.VisualEditorCanvas),

  { ssr: false, loading: () => <p className="text-sm text-zinc-500">載入編輯器…</p> },

);



export function VisualPhaseClient({
  projectId,
  projectTitle,
  initialComposition,
  initialLocks,
}: {
  projectId: string;
  projectTitle: string;
  initialComposition: CourseComposition;
  initialLocks: PhaseLocks;
}) {

  const [composition, setComposition] = useState(initialComposition);

  const initialCompositionKey = useMemo(
    () => JSON.stringify(initialComposition),
    [initialComposition],
  );

  const [savedCompositionKey, setSavedCompositionKey] = useState(initialCompositionKey);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(composition) !== savedCompositionKey,
    [composition, savedCompositionKey],
  );

  useEffect(() => {
    setComposition(initialComposition);
    setSavedCompositionKey(initialCompositionKey);
  }, [initialComposition, initialCompositionKey]);

  const [locks, setLocks] = useState(initialLocks);

  const [themes, setThemes] = useState<ClientThemeOption[]>([]);

  const [themePreviewCss, setThemePreviewCss] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const router = useRouter();

  const locked = locks.visual;



  useEffect(() => {

    fetch("/api/themes")

      .then((r) => r.json())

      .then((d) => setThemes(d.themes ?? []));

  }, []);



  useEffect(() => {

    const themeId = composition.meta.themeId;

    if (!themeId) {

      setThemePreviewCss(null);

      return;

    }

    fetch(`/api/themes/${themeId}`)

      .then((r) => r.json())

      .then((d) => setThemePreviewCss(d.editorPreviewCss ?? null))

      .catch(() => setThemePreviewCss(null));

  }, [composition.meta.themeId]);



  const save = useCallback(async () => {

    setSaving(true);

    try {

      const res = await fetch(`/api/projects/${projectId}/composition`, {

        method: "PUT",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ phase: "visual", composition }),

      });

      if (!res.ok) {

        toast((await res.json()).error ?? "儲存失敗", "error");

        return;

      }

      await fetch(`/api/projects/${projectId}`, {

        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ theme_id: composition.meta.themeId }),

      });

      toast("視覺設定已儲存", "success");

      setSavedCompositionKey(JSON.stringify(composition));

    } finally {

      setSaving(false);

    }

  }, [projectId, composition, toast]);



  const activeTheme = themes.find((t) => t.id === composition.meta.themeId);




  const unlockPhase = async () => {
    const res = await fetch(`/api/projects/${projectId}/phases/visual/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    const data = await res.json();
    setLocks(data.phase_locks);
    router.refresh();
    toast("已解除鎖定", "info");
  };

  return (

    <div className="space-y-6">

      <ProjectPhaseNav
        projectId={projectId}
        current="visual"
        locks={locks}
        onLocksChange={setLocks}
        onBeforeLock={save}
      />



      <section className="cf-card cf-card-padded space-y-2">

        <h2 className="cf-section-title">所見即所得編輯器</h2>

        <p className="text-xs text-zinc-500">

          調整每個步驟的視覺外觀、動畫與轉場。選擇主題會套用 tokens.css 的完整設計系統（色彩、字型、舞台裝飾）。

        </p>

        <div className="flex flex-wrap items-end gap-3 pt-1">

          <label className="block text-xs text-zinc-500">

            主題

            <select

              value={composition.meta.themeId ?? ""}

              disabled={locked}

              onChange={(e) => {

                const themeId = e.target.value || null;

                const theme = themes.find((item) => item.id === themeId) ?? null;

                setComposition(applyThemeToComposition(composition, theme));

                toast(

                  theme

                    ? `已套用主題「${theme.nameZh}」（色彩、字型、動畫、舞台裝飾）`

                    : "已清除主題",

                  "info",

                );

              }}

              className="cf-select mt-1 min-w-[180px]"

            >

              <option value="">選擇主題</option>

              {themes.map((t) => (

                <option key={t.id} value={t.id}>

                  {t.nameZh}

                </option>

              ))}

            </select>

          </label>

          {activeTheme ? (

            <p className="text-xs text-zinc-600">

              {activeTheme.descriptionZh ?? activeTheme.description}

            </p>

          ) : null}

        </div>

      </section>



      <VisualEditorCanvas
        key={String(locks.visual)}
        projectId={projectId}
        projectTitle={projectTitle}
        composition={composition}
        setComposition={setComposition}
        locked={locked}
        themePreviewCss={themePreviewCss}
        onSave={!locked ? save : undefined}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <PhaseBottomActions
        projectId={projectId}
        phase="visual"
        locks={locks}
        onUnlock={unlockPhase}
      />
    </div>

  );

}

