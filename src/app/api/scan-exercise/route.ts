import { NextResponse } from "next/server";
import { estimateExercise } from "@/lib/exercise-extract";
import { adminAuth } from "@/lib/firebase-admin";

// Deskripsi olahraga → estimasi kkal terbakar. Wajib login (ID token).
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { text, weightKg } = (await request.json()) || {};
    if (!text) return NextResponse.json({ error: "text wajib diisi" }, { status: 400 });

    const exercise = await estimateExercise(text, weightKg);
    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("scan-exercise error:", error);
    return NextResponse.json({ error: "Gagal estimasi olahraga" }, { status: 500 });
  }
}
