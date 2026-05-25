import { NextResponse } from "next/server";

/** M2：建立專案 presentation/ 腳手架 */
export async function POST() {
  return NextResponse.json(
    { error: "WVP scaffold API 將於 M2 實作（@courseflow/presentation）" },
    { status: 501 },
  );
}
