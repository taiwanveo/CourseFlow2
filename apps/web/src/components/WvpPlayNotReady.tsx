"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LottieMark } from "@/components/lottie/LottieMark";
import { useUiMotion } from "@/components/motion/presets";

export function WvpPlayNotReady({
  projectId,
  projectTitle,
  reason,
  returnHref,
}: {
  projectId: string;
  projectTitle: string;
  reason: "not-built" | "build-stale";
  returnHref?: string;
}) {
  const { pop } = useUiMotion();
  const title =
    reason === "build-stale"
      ? "預覽檔案遺失，請重新建置"
      : "尚未建置 WVP 預覽";
  const detail =
    reason === "build-stale"
      ? "資料庫顯示曾建置成功，但本機 dist 找不到（可能路徑或檔案被刪除）。請回到視覺動效重新試執行第 1 章，或於「4. 預覽匯出」重新打包。"
      : returnHref
        ? "請先在「2. 視覺動效」完成「試執行第 1 章」，建置成功後才能預覽。"
        : "請依序完成：「視覺動效」完成/鎖定 →「語音生成」批次 TTS →「預覽匯出」打包課程。建置成功後才能進入播放畫面。";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6">
      <motion.div
        className="max-w-md space-y-4 text-center"
        variants={pop}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <div className="mx-auto mb-2 flex justify-center">
          <LottieMark variant="loading" size={56} ariaLabel="建置引導" />
        </div>
        <p className="text-xs uppercase tracking-wider text-zinc-500">{projectTitle}</p>
        <h1 className="text-xl font-medium text-zinc-100">{title}</h1>
        <p className="text-sm text-zinc-400">{detail}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href={`/projects/${projectId}/publish`} className="cf-btn cf-btn-primary">
            前往預覽匯出
          </Link>
          <Link href={`/projects/${projectId}/audio`} className="cf-btn cf-btn-secondary">
            語音生成
          </Link>
          <Link href={`/projects/${projectId}/craft`} className="cf-btn cf-btn-secondary">
            視覺動效
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
