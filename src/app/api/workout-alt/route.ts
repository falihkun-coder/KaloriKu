import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { suggestWorkoutAlternatives } from "@/lib/workout-advisor";
import { recordAiUsage } from "@/lib/ai-usage";

// Cari alternatif gerakan latihan dari alasan/konteks user. Wajib login.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const reason = String(body?.reason || "").trim();
    const target = body?.target ? String(body.target).trim() : undefined;
    if (!reason) return NextResponse.json({ error: "reason wajib diisi" }, { status: 400 });

    const { alternatives, usage } = await suggestWorkoutAlternatives({ reason, target });
    await recordAiUsage(uid, usage);
    return NextResponse.json({ alternatives });
  } catch (error) {
    console.error("workout-alt error:", error);
    return NextResponse.json({ error: "Gagal cari alternatif" }, { status: 500 });
  }
}
