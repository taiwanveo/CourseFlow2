import { NextResponse } from "next/server";

/** v2 已停用 v1 投影片視覺佇列；請改用章節 Craft API（M2）。 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "v2 已停用 generate-visuals。請使用 WVP 章節 Craft（見 docs/VISION-v2.md）。",
    },
    { status: 501 },
  );
}
