import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { suggestMeals } from "@/lib/advisor";
import { FoodEntry, Goals, DEFAULT_GOALS, consumedToday } from "@/lib/calculations";

// Saran menu dari sisa kalori/macro user (brief §07). Wajib login.
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

    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const [entriesSnap, goalsDoc] = await Promise.all([
      adminDb.collection("foodEntries").where("userId", "==", uid).where("createdAt", ">=", since).get(),
      adminDb.collection("goals").doc(uid).get(),
    ]);
    const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FoodEntry[];
    const goals: Goals = goalsDoc.exists ? { ...DEFAULT_GOALS, ...(goalsDoc.data() as Goals) } : DEFAULT_GOALS;

    const suggestions = await suggestMeals(goals, consumedToday(entries));
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("advisor error:", error);
    return NextResponse.json({ error: "Gagal bikin saran" }, { status: 500 });
  }
}
