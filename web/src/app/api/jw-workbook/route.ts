// ─── GET /api/jw-workbook?weekId=2026-W34 ─────────────────────────────────────
// Server-side proxy to the JW WOL meeting workbook. Browser clients cannot
// fetch WOL directly (CORS), so this route fetches/parses server-side and
// returns `{ weekId, bibleReadingEn, bibleReadingEs }`.

import { NextRequest, NextResponse } from "next/server";
import { getWorkbookReading } from "@/lib/jwWorkbook";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const weekId = request.nextUrl.searchParams.get("weekId");

  if (!weekId) {
    return NextResponse.json({ error: "Missing weekId query parameter" }, { status: 400 });
  }

  const result = await getWorkbookReading(weekId);

  if ("code" in result) {
    if (result.code === "INVALID_WEEK") {
      return NextResponse.json({ error: `Invalid weekId: ${weekId}` }, { status: 400 });
    }
    if (result.code === "WEEK_NOT_FOUND") {
      return NextResponse.json({ error: `Week not found in workbook: ${weekId}` }, { status: 404 });
    }
    return NextResponse.json({ error: `WOL fetch/parse failed: ${result.message}` }, { status: 502 });
  }

  return NextResponse.json(result);
}