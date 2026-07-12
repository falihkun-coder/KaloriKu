import { NextResponse } from "next/server";

// Endpoint ringan buat keep-warm — dipanggil scheduled function tiap 5 menit
// biar SSR Cloud Run instance gak scale-to-zero (Discord butuh respons <3 dtk,
// cold start bisa >3 dtk). minInstances gak kepake karena bentrok pinTags.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, t: Date.now() });
}
