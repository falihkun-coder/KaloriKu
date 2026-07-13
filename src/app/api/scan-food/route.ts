import { NextResponse } from "next/server";
import { extractFood } from "@/lib/ai-extract";
import { adminAuth } from "@/lib/firebase-admin";
import { recordAiUsage } from "@/lib/ai-usage";

// Foto makanan / label nutrisi / teks bebas → JSON nutrisi + confidence.
// Wajib login (ID token) biar kuota Gemini gak bisa dipakai orang luar.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, imageBase64, mimeType, caption } = body || {};
    if (!text && !imageBase64) {
      return NextResponse.json({ error: "text atau imageBase64 wajib diisi" }, { status: 400 });
    }

    const food = await extractFood({ text, imageBase64, mimeType, caption });
    await recordAiUsage(uid, food.usage);
    return NextResponse.json({ food });
  } catch (error) {
    console.error("scan-food error:", error);
    return NextResponse.json({ error: "Gagal ekstrak nutrisi" }, { status: 500 });
  }
}
