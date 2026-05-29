import type { ChapterDef } from "./types";
import OpeningChapter from "../chapters/01-opening/Opening";
import { narrations as openingNarrations } from "../chapters/01-opening/narrations";
import TenderTypesChapter from "../chapters/02-tender-types/TenderTypes";
import { narrations as tenderTypesNarrations } from "../chapters/02-tender-types/narrations";
import AwardChapter from "../chapters/03-award/Award";
import { narrations as awardNarrations } from "../chapters/03-award/narrations";
import NoTransferChapter from "../chapters/04-no-transfer/NoTransfer";
import { narrations as noTransferNarrations } from "../chapters/04-no-transfer/narrations";
import PaymentChapter from "../chapters/05-payment/Payment";
import { narrations as paymentNarrations } from "../chapters/05-payment/narrations";
import DisputeChapter from "../chapters/06-dispute/Dispute";
import { narrations as disputeNarrations } from "../chapters/06-dispute/narrations";
import PenaltyChapter from "../chapters/07-penalty/Penalty";
import { narrations as penaltyNarrations } from "../chapters/07-penalty/narrations";
import ForYouChapter from "../chapters/08-for-you/ForYou";
import { narrations as forYouNarrations } from "../chapters/08-for-you/narrations";

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
    id: "opening",
    title: "一部法律，四個關鍵字",
    narrations: openingNarrations,
    Component: OpeningChapter,
  },
  {
    id: "tender-types",
    title: "三種招標方式",
    narrations: tenderTypesNarrations,
    Component: TenderTypesChapter,
  },
  {
    id: "award",
    title: "決標：最低標 vs 最有利標",
    narrations: awardNarrations,
    Component: AwardChapter,
  },
  {
    id: "no-transfer",
    title: "履約紅線：不得轉包",
    narrations: noTransferNarrations,
    Component: NoTransferChapter,
  },
  {
    id: "payment",
    title: "驗收與付款：15 天大限",
    narrations: paymentNarrations,
    Component: PaymentChapter,
  },
  {
    id: "dispute",
    title: "爭議救濟：異議 → 申訴 → 調解仲裁",
    narrations: disputeNarrations,
    Component: DisputeChapter,
  },
  {
    id: "penalty",
    title: "違規代價：刑罰與黑名單",
    narrations: penaltyNarrations,
    Component: PenaltyChapter,
  },
  {
    id: "for-you",
    title: "對你的意義",
    narrations: forYouNarrations,
    Component: ForYouChapter,
  },
];
