import type { ChapterDef } from "./types";
import HookChapter from "../chapters/01-hook/Hook";
import { narrations as hookNarrations } from "../chapters/01-hook/narrations";
import WorkflowChapter from "../chapters/02-workflow/Workflow";
import { narrations as workflowNarrations } from "../chapters/02-workflow/narrations";
import CheckpointChapter from "../chapters/03-checkpoint/Checkpoint";
import { narrations as checkpointNarrations } from "../chapters/03-checkpoint/narrations";
import FeaturesChapter from "../chapters/04-features/Features";
import { narrations as featuresNarrations } from "../chapters/04-features/narrations";
import ClosingChapter from "../chapters/05-closing/Closing";
import { narrations as closingNarrations } from "../chapters/05-closing/narrations";

/**
 * Order = order of presentation.
 *
 * Each chapter MUST provide a `narrations: Narration[]` array. Its length
 * is the chapter's step count — there is no `totalSteps` to maintain
 * separately. This guarantees the audio synthesis pipeline, the runtime
 * stepper, and the chapter `.tsx` switch on `step` cannot drift apart.
 *
 * Visual styling (color, fonts) comes entirely from the active theme —
 * chapters never hard-code palette / font names. See THEMES.md.
 */
export const CHAPTERS: ChapterDef[] = [
  {
    id: "hook",
    title: "文章能變影片？",
    narrations: hookNarrations,
    Component: HookChapter,
  },
  {
    id: "workflow",
    title: "四階段工作流",
    narrations: workflowNarrations,
    Component: WorkflowChapter,
  },
  {
    id: "checkpoint",
    title: "一次對齊五件事",
    narrations: checkpointNarrations,
    Component: CheckpointChapter,
  },
  {
    id: "features",
    title: "六大內建功能",
    narrations: featuresNarrations,
    Component: FeaturesChapter,
  },
  {
    id: "closing",
    title: "適合什麼場景",
    narrations: closingNarrations,
    Component: ClosingChapter,
  },
];
