import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "courseflow-v2-web",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
