import { NextResponse } from "next/server";
import { estimateExercise } from "@/lib/exercise-extract";
import { adminAuth } from "@/lib/firebase-admin";
import { recordAiUsage } from "@/lib/ai-usage";

// Deskripsi olahraga → estimasi kkal terbakar. Wajib login (ID token).
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

    const { text, weightKg } = (await request.json()) || {};
    if (!text) return NextResponse.json({ error: "text wajib diisi" }, { status: 400 });

    const exercise = await estimateExercise(text, weightKg);
    await recordAiUsage(uid, exercise.usage);
    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("scan-exercise error:", error);
    return NextResponse.json({ error: "Gagal estimasi olahraga" }, { status: 500 });
  }
}
