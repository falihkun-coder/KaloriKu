import { GoogleGenerativeAI } from "@google/generative-ai";
import { Goals, SavedMeal, MealType, DayKey, MealPlan, PlannedMeal, MEAL_ORDER, WEEKDAY_ORDER, WEEKDAY_LABELS, mealLabel } from "@/lib/calculations";
import { AiUsage, GEMINI_MODEL } from "@/lib/ai-pricing";
import { readUsage } from "@/lib/ai-extract";

const VALID_MEALS = new Set<string>(MEAL_ORDER);
const VALID_DAYS = new Set<string>(WEEKDAY_ORDER);

function cleanPlanned(raw: unknown, library: SavedMeal[]): PlannedMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || "").trim().slice(0, 80);
  if (!name) return null;
  const num = (v: unknown, dec = 0) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return dec ? Math.round(n * 10) / 10 : Math.round(n);
  };
  // Kalau namanya persis favorit di library, tempel mealId biar 1-tap log akurat
  const match = library.find(
    (m) => mealLabel(m).toLowerCase() === name.toLowerCase() || m.name.toLowerCase() === name.toLowerCase()
  );
  return {
    name,
    kcal: num(r.kcal),
    protein_g: num(r.protein_g, 1),
    carbs_g: num(r.carbs_g, 1),
    fat_g: num(r.fat_g, 1),
    portion: String(r.portion || "1 porsi").trim().slice(0, 40) || "1 porsi",
    ...(match ? { mealId: match.id } : {}),
    ...(r.reason ? { reason: String(r.reason).slice(0, 160) } : {}),
  };
}

function libraryBlock(library: SavedMeal[]): string {
  if (library.length === 0) return "(kosong — pakai makanan Indonesia umum yang gampang didapat)";
  return library
    .slice(0, 40)
    .map((m) => `- ${mealLabel(m)} — ${m.kcal} kkal, P${m.protein_g} K${m.carbs_g} L${m.fat_g}, ${m.portion || "1 porsi"}`)
    .join("\n");
}

function targetsBlock(goals: Goals): string {
  return `${goals.kcalTarget} kkal/hari · protein ${goals.proteinTarget} g · karbo ${goals.carbsTarget} g · lemak ${goals.fatTarget} g`;
}

/**
 * Generate rencana makan 7 hari (Senin–Minggu) dari target + meal library user.
 * Diprioritaskan pakai favorit yang udah ada biar realistis & gampang dieksekusi.
 */
export async function generateWeeklyPlan(input: {
  goals: Goals;
  library: SavedMeal[];
  preferences?: string;
}): Promise<{ days: MealPlan["days"]; usage?: AiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
    Kamu ahli gizi Indonesia. Susun RENCANA MAKAN 7 HARI (Senin–Minggu) buat user yang lagi cutting.

    TARGET HARIAN: ${targetsBlock(input.goals)}

    FAVORIT USER (meal library — PRIORITASKAN ini, tulis namanya PERSIS sama):
    ${libraryBlock(input.library)}

    ${input.preferences?.trim() ? `PREFERENSI/CATATAN USER (WAJIB dihormati): "${input.preferences.trim()}"` : ""}

    Aturan:
    - Tiap hari: sarapan, siang, malam WAJIB ada. snack opsional (isi kalau masih ada ruang kalori).
    - Total kalori per hari harus MENDEKATI target (selisih maks ~100 kkal). Protein diutamakan mendekati/melebihi target — ini kunci jaga otot pas defisit.
    - VARIASI: jangan ngulang menu yang sama lebih dari 2x seminggu, dan jangan 2 hari berturut-turut menu identik. Ini biar user gak bosen.
    - REALISTIS: makanan Indonesia rumahan/warung yang gampang dibuat/dibeli. Sarapan simpel (user kerja).
    - Kalau pakai item dari favorit user, tulis "name" PERSIS seperti di daftar favorit (termasuk nama restonya kalau ada), dan pakai angka gizi yang sama.
    - Untuk menu di luar favorit, estimasi realistis untuk porsi yang disebut.
    - reason: 1 kalimat pendek bahasa Indonesia santai, kenapa menu itu dipilih hari itu.

    Balas HANYA JSON valid (tanpa markdown/backtick) dengan bentuk:
    {
      "sen": {
        "sarapan": { "name": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "portion": string, "reason": string },
        "siang": { ... }, "malam": { ... }, "snack": { ... }
      },
      "sel": { ... }, "rab": { ... }, "kam": { ... }, "jum": { ... }, "sab": { ... }, "min": { ... }
    }
    Kunci hari HARUS: sen, sel, rab, kam, jum, sab, min.
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanJson) as Record<string, unknown>;

  const days = { sen: {}, sel: {}, rab: {}, kam: {}, jum: {}, sab: {}, min: {} } as MealPlan["days"];
  for (const [dayKey, dayVal] of Object.entries(parsed)) {
    if (!VALID_DAYS.has(dayKey) || !dayVal || typeof dayVal !== "object") continue;
    for (const [mealKey, mealVal] of Object.entries(dayVal as Record<string, unknown>)) {
      if (!VALID_MEALS.has(mealKey)) continue;
      const planned = cleanPlanned(mealVal, input.library);
      if (planned) days[dayKey as DayKey][mealKey as MealType] = planned;
    }
  }

  return { days, usage: readUsage(result.response) };
}

/** Ganti 1 slot doang (tombol "ganti" — biar gak perlu regenerate seminggu). */
export async function generateSingleSlot(input: {
  goals: Goals;
  library: SavedMeal[];
  day: DayKey;
  meal: MealType;
  avoid?: string;
  otherMealsToday?: { meal: MealType; name: string; kcal: number }[];
  preferences?: string;
}): Promise<{ planned: PlannedMeal | null; usage?: AiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const others = (input.otherMealsToday || []).map((o) => `- ${o.meal}: ${o.name} (${o.kcal} kkal)`).join("\n");
  const sisaKcal =
    input.goals.kcalTarget - (input.otherMealsToday || []).reduce((s, o) => s + (o.kcal || 0), 0);

  const prompt = `
    Kamu ahli gizi Indonesia. Ganti SATU slot makan di rencana harian user.

    TARGET HARIAN: ${targetsBlock(input.goals)}
    Hari: ${WEEKDAY_LABELS[input.day]} · Slot yang diganti: ${input.meal}
    ${others ? `Menu lain di hari yang sama:\n${others}\nSisa jatah buat slot ini: ~${sisaKcal} kkal.` : ""}
    ${input.avoid ? `JANGAN kasih menu yang sama/mirip dengan: "${input.avoid}" — user minta ganti.` : ""}
    ${input.preferences?.trim() ? `PREFERENSI USER (WAJIB dihormati): "${input.preferences.trim()}"` : ""}

    FAVORIT USER (prioritaskan, tulis nama PERSIS):
    ${libraryBlock(input.library)}

    Balas HANYA JSON valid (tanpa markdown/backtick):
    { "name": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "portion": string, "reason": string }
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const planned = cleanPlanned(JSON.parse(cleanJson), input.library);

  return { planned, usage: readUsage(result.response) };
}
