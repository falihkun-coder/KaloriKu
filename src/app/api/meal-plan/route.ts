import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { generateWeeklyPlan, generateSingleSlot, generateComponentSwap, splitIntoComponents } from "@/lib/meal-planner";
import { recordAiUsage } from "@/lib/ai-usage";
import { SavedMeal, Goals, DayKey, MealType, PlannedItem, PlannedMeal, DEFAULT_GOALS } from "@/lib/calculations";

// Generate rencana makan mingguan (atau ganti 1 slot) dari target + meal library. Wajib login.
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

    const body = await request.json().catch(() => ({}));
    const preferences = body?.preferences ? String(body.preferences).slice(0, 400) : undefined;

    const [mealsSnap, goalsDoc, planDoc] = await Promise.all([
      adminDb.collection("meals").where("userId", "==", uid).get(),
      adminDb.collection("goals").doc(uid).get(),
      adminDb.collection("mealPlans").doc(uid).get(),
    ]);
    const library = mealsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SavedMeal[];
    const goals: Goals = goalsDoc.exists ? { ...DEFAULT_GOALS, ...(goalsDoc.data() as Goals) } : DEFAULT_GOALS;
    // Blacklist dibaca dari server biar selalu terbaru (client bisa stale)
    const saved = planDoc.exists ? (planDoc.data() as { dislikes?: unknown }) : null;
    const dislikes = Array.isArray(saved?.dislikes) ? (saved.dislikes as string[]).slice(0, 40) : [];

    // Mode "component": ganti 1 komponen di dalam menu (mis. sop ikannya doang)
    if (body?.mode === "component") {
      const components = Array.isArray(body.components) ? (body.components as PlannedItem[]).slice(0, 8) : [];
      const targetIndex = Number(body.targetIndex);
      if (components.length === 0 || !Number.isInteger(targetIndex) || !components[targetIndex]) {
        return NextResponse.json({ error: "components & targetIndex wajib valid" }, { status: 400 });
      }
      const { item, usage } = await generateComponentSwap({
        goals,
        mealName: String(body.mealName || "").slice(0, 160),
        meal: String(body.meal || "siang") as MealType,
        components,
        targetIndex,
        dislikes,
        preferences,
      });
      await recordAiUsage(uid, usage);
      return NextResponse.json({ item });
    }

    // Mode "split": pecah menu lama jadi komponen-komponen
    if (body?.mode === "split") {
      if (!body?.meal?.name) return NextResponse.json({ error: "meal wajib" }, { status: 400 });
      const { items, usage } = await splitIntoComponents({ meal: body.meal as PlannedMeal });
      await recordAiUsage(uid, usage);
      return NextResponse.json({ items });
    }

    // Mode "slot": ganti satu menu doang
    if (body?.mode === "slot") {
      const day = String(body.day || "") as DayKey;
      const meal = String(body.meal || "") as MealType;
      if (!day || !meal) return NextResponse.json({ error: "day & meal wajib" }, { status: 400 });

      const { planned, usage } = await generateSingleSlot({
        goals,
        library,
        day,
        meal,
        avoid: body.avoid ? String(body.avoid).slice(0, 120) : undefined,
        otherMealsToday: Array.isArray(body.otherMealsToday) ? body.otherMealsToday.slice(0, 4) : undefined,
        preferences,
        dislikes,
      });
      await recordAiUsage(uid, usage);
      return NextResponse.json({ planned });
    }

    const { days, usage } = await generateWeeklyPlan({ goals, library, preferences, dislikes });
    await recordAiUsage(uid, usage);
    return NextResponse.json({ days });
  } catch (error) {
    console.error("meal-plan error:", error);
    return NextResponse.json({ error: "Gagal bikin rencana" }, { status: 500 });
  }
}
