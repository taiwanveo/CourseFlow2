import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseComposition, StepAudio } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import {
  writePresentationAudioFiles,
  type PresentationAudioFile,
} from "@courseflow/presentation";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { narrationsForChapter } from "@/lib/wvp-chapters";

type CraftRow = {
  wvp_chapter_id: string;
  title: string;
  sort_order: number;
  checklist_result?: { narrations?: string[] } | null;
};

export type WvpAudioSyncResult = {
  written: number;
  /** WVP 簡報逐步口播總數（應有 mp3 的步數） */
  expectedSteps: number;
  /** composition 內已登記的 TTS 條數 */
  compositionAudioCount: number;
};

function normalizeText(s: string): string {
  return s.replace(/\s+/g, "").trim().slice(0, 80);
}

function craftNarrations(
  craft: CraftRow,
  composition: CourseComposition,
  chapterId: string,
): string[] {
  const fromCraft = craft.checklist_result?.narrations?.filter((n) => n?.trim()) ?? [];
  if (fromCraft.length > 0) return fromCraft;
  return narrationsForChapter(composition, chapterId);
}

function audioByStepId(composition: CourseComposition): Map<string, StepAudio> {
  const map = new Map<string, StepAudio>();
  for (const a of composition.audio) {
    if (a.stepId && a.storagePath) map.set(a.stepId, a);
  }
  return map;
}

function findAudioForNarration(
  narration: string,
  steps: { id: string; script: string; screenContent: string }[],
  byStep: Map<string, StepAudio>,
): StepAudio | undefined {
  const n = normalizeText(narration);
  if (!n) return undefined;
  for (const step of steps) {
    const blob = normalizeText(step.script || step.screenContent);
    if (!blob) continue;
    if (blob === n || blob.includes(n) || n.includes(blob.slice(0, 40))) {
      const hit = byStep.get(step.id);
      if (hit) return hit;
    }
  }
  return undefined;
}

async function downloadAudioBuffer(
  supabase: SupabaseClient,
  audio: StepAudio,
): Promise<Buffer | null> {
  if (audio.storagePath) {
    const { data, error } = await supabase.storage
      .from("courseflow-assets")
      .download(audio.storagePath);
    if (!error && data) return Buffer.from(await data.arrayBuffer());
  }
  if (audio.publicUrl?.trim()) {
    try {
      const res = await fetch(audio.publicUrl);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * 依 Craft／WVP 的 narrations 步數寫入 presentation/public/audio/
 * （與 App.tsx 路徑一致：audio/<wvpChapterId>/<1-based>.mp3）
 */
export async function syncPresentationAudioFromComposition(
  supabase: SupabaseClient,
  projectId: string,
  composition: CourseComposition,
  crafts: CraftRow[],
): Promise<WvpAudioSyncResult> {
  const presentationDir = presentationDirForProject(projectId);
  const files: PresentationAudioFile[] = [];
  const byStep = audioByStepId(composition);
  let expectedSteps = 0;

  for (const craft of crafts) {
    const chapter = composition.chapters.find((c) => c.title === craft.title);
    if (!chapter) continue;

    const compSteps = composition.steps
      .filter((s) => s.chapterId === chapter.id && !isChapterStep(s))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.id,
        script: s.script?.trim() ?? "",
        screenContent: s.screenContent?.trim() ?? "",
      }));

    const narrations = craftNarrations(craft, composition, chapter.id);
    expectedSteps += narrations.length;

    for (let i = 0; i < narrations.length; i++) {
      const narration = narrations[i] ?? "";
      if (!narration.trim()) continue;

      let audioMeta: StepAudio | undefined;
      const compStep = compSteps[i];
      if (compStep) audioMeta = byStep.get(compStep.id);
      if (!audioMeta) audioMeta = findAudioForNarration(narration, compSteps, byStep);

      if (!audioMeta) continue;
      const buffer = await downloadAudioBuffer(supabase, audioMeta);
      if (!buffer?.length) continue;

      files.push({
        wvpChapterId: craft.wvp_chapter_id,
        stepIndex: i,
        buffer,
      });
    }
  }

  const written = await writePresentationAudioFiles(presentationDir, files);
  return {
    written,
    expectedSteps,
    compositionAudioCount: composition.audio.length,
  };
}
