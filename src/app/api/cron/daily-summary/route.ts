import { NextResponse } from "next/server";
import { sendDailySummaries } from "@/lib/cron-summaries";

// Dipanggil scheduled function tiap 21.00 WIB (header x-cron-secret).
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendDailySummaries();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("daily-summary error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
