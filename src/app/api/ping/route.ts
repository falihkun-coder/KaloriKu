import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Endpoint keep-warm — dipanggil scheduled function tiap 5 menit biar SSR
// Cloud Run instance gak scale-to-zero (Discord butuh respons <3 dtk, cold
// start bisa >3 dtk; minInstances bentrok pinTags Hosting).
// Nyentuh Firestore juga biar gRPC channel firebase-admin ikut hangat —
// tanpa ini, call Firestore pertama setelah nganggur tetap lambat.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await adminDb.collection("users").limit(1).get();
  } catch {
    /* keep-warm best effort */
  }
  return NextResponse.json({ ok: true, t: Date.now() });
}
