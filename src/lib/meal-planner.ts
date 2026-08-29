import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Goals,
  SavedMeal,
  MealType,
  DayKey,
  MealPlan,
  PlannedMeal,
  PlannedItem,
  MEAL_ORDER,
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  mealLabel,
  sumPlannedItems,
} from "@/lib/calculations";
import { AiUsage, GEMINI_MODEL } from "@/lib/ai-pricing";
import { readUsage } from "@/lib/ai-extract";

const VALID_MEALS = new Set<string>(MEAL_ORDER);
const VALID_DAYS = new Set<string>(WEEKDAY_ORDER);

const num = (v: unknown, dec = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return dec ? Math.round(n * 10) / 10 : Math.round(n);
};

/** Bersihin 1 komponen menu (nama + makro sendiri). */
export function cleanItem(raw: unknown): PlannedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || "").trim().slice(0, 60);
  if (!name) return null;
  return {
    name,
    kcal: num(r.kcal),
    protein_g: num(r.protein_g, 1),
    carbs_g: num(r.carbs_g, 1),
    fat_g: num(r.fat_g, 1),
  };
}

function cleanItems(raw: unknown): PlannedItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.map(cleanItem).filter((x): x is PlannedItem => !!x).slice(0, 8);
  // 1 komponen doang = sama aja kayak menu tunggal, gak usah dipecah
  return items.length >= 2 ? items : undefined;
}

function cleanPlanned(raw: unknown, library: SavedMeal[]): PlannedMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || "").trim().slice(0, 120);
  if (!name) return null;
  // Kalau namanya persis favorit di library, tempel mealId biar 1-tap log akurat
  const match = library.find(
    (m) => mealLabel(m).toLowerCase() === name.toLowerCase() || m.name.toLowerCase() === name.toLowerCase()
  );
  const items = cleanItems(r.items);
  // Total selalu ngikut komponen kalau ada — biar konsisten pas komponen diganti
  const totals = items ? sumPlannedItems(items) : null;
  return {
    name,
    kcal: totals ? totals.kcal : num(r.kcal),
    protein_g: totals ? totals.protein_g : num(r.protein_g, 1),
    carbs_g: totals ? totals.carbs_g : num(r.carbs_g, 1),
    fat_g: totals ? totals.fat_g : num(r.fat_g, 1),
    portion: String(r.portion || "1 porsi").trim().slice(0, 40) || "1 porsi",
    ...(items ? { items } : {}),
    ...(match && !items ? { mealId: match.id } : {}),
    ...(r.reason ? { reason: String(r.reason).slice(0, 160) } : {}),
  };
}

// Format komponen yang dipakai di beberapa prompt.
const ITEM_SHAPE = `{ "name": string (komponen tunggal, sertakan takaran mis. "Nasi putih 150g"), "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number }`;

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

// Blacklist user — aturan paling keras, di atas preferensi lain.
function dislikesBlock(dislikes?: string[]): string {
  const list = (dislikes || []).map((d) => d.trim()).filter(Boolean);
  if (list.length === 0) return "";
  return `
    ❌ DAFTAR TIDAK DISUKAI (ATURAN PALING KERAS — JANGAN DILANGGAR):
    ${list.map((d) => `- ${d}`).join("\n    ")}
    JANGAN pernah menyarankan menu di atas, ATAU menu apa pun yang MENGANDUNG / berbahan dasar /
    merupakan variasi dekat dari item-item itu. Kalau sebuah menu favorit user mengandung salah satunya,
    lewati menu itu dan pilih alternatif lain. Aturan ini mengalahkan preferensi & daftar favorit.`;
}

/**
 * Generate rencana makan 7 hari (Senin–Minggu) dari target + meal library user.
 * Diprioritaskan pakai favorit yang udah ada biar realistis & gampang dieksekusi.
 */
export async function generateWeeklyPlan(input: {
  goals: Goals;
  library: SavedMeal[];
  preferences?: string;
  dislikes?: string[];
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
    ${dislikesBlock(input.dislikes)}

    Aturan:
    - Tiap hari: sarapan, siang, malam WAJIB ada. snack opsional (isi kalau masih ada ruang kalori).
    - Total kalori per hari harus MENDEKATI target (selisih maks ~100 kkal). Protein diutamakan mendekati/melebihi target — ini kunci jaga otot pas defisit.
    - VARIASI: jangan ngulang menu yang sama lebih dari 2x seminggu, dan jangan 2 hari berturut-turut menu identik. Ini biar user gak bosen.
    - REALISTIS: makanan Indonesia rumahan/warung yang gampang dibuat/dibeli. Sarapan simpel (user kerja).
    - Kalau pakai item dari favorit user, tulis "name" PERSIS seperti di daftar favorit (termasuk nama restonya kalau ada), dan pakai angka gizi yang sama.
    - Untuk menu di luar favorit, estimasi realistis untuk porsi yang disebut.
    - reason: 1 kalimat pendek bahasa Indonesia santai, kenapa menu itu dipilih hari itu.
    - items: WAJIB pecah tiap menu jadi komponen terpisah (lauk, karbo, sayur, minuman) — user mau bisa
      ganti komponennya satuan. Contoh "Sop ikan kakap & Dada ayam panggang & Nasi putih 150g" jadi 3 item.
      Makro tiap item HARUS dijumlah = makro total menu. Menu yang emang tunggal (mis. "Apel 1 buah")
      boleh cuma 1 item. Tulis takaran di nama item biar jelas.

    Balas HANYA JSON valid (tanpa markdown/backtick) dengan bentuk:
    {
      "sen": {
        "sarapan": { "name": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "portion": string, "reason": string, "items": [${ITEM_SHAPE}] },
        "siang": { ... }, "malam": { ... }, "snack": { ... }
      },
      "sel": { ... }, "rab": { ... }, "kam": { ... }, "jum": { ... }, "sab": { ... }, "min": { ... }
    }
    Kunci hari HARUS: sen, sel, rab, kam, jum, sab, min. Ringkas — jangan tambah field lain.
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
  dislikes?: string[];
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
    ${dislikesBlock(input.dislikes)}

    FAVORIT USER (prioritaskan, tulis nama PERSIS):
    ${libraryBlock(input.library)}

    Pecah menu jadi komponen terpisah di "items" (lauk, karbo, sayur, minuman) — makro item dijumlah = total.

    Balas HANYA JSON valid (tanpa markdown/backtick):
    { "name": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "portion": string, "reason": string, "items": [${ITEM_SHAPE}] }
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const planned = cleanPlanned(JSON.parse(cleanJson), input.library);

  return { planned, usage: readUsage(result.response) };
}

/**
 * Ganti SATU komponen di dalam menu (mis. tuker "Sop ikan kakap" doang,
 * dada ayam & nasinya tetap). Balikin komponen pengganti lengkap sama makronya.
 */
export async function generateComponentSwap(input: {
  goals: Goals;
  mealName: string;
  meal: MealType;
  components: PlannedItem[];
  targetIndex: number;
  dislikes?: string[];
  preferences?: string;
}): Promise<{ item: PlannedItem | null; usage?: AiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const target = input.components[input.targetIndex];
  if (!target) return { item: null };
  const keep = input.components
    .filter((_, i) => i !== input.targetIndex)
    .map((c) => `- ${c.name} (${c.kcal} kkal, P${c.protein_g})`)
    .join("\n    ");

  const prompt = `
    Kamu ahli gizi Indonesia. User punya menu "${input.mealName}" (${input.meal}) dan mau GANTI SATU KOMPONEN aja.

    KOMPONEN YANG DIGANTI: "${target.name}" (${target.kcal} kkal, P${target.protein_g} K${target.carbs_g} L${target.fat_g})
    Komponen lain TETAP (jangan diubah, jangan diduplikat):
    ${keep || "(gak ada — ini satu-satunya komponen)"}

    Target harian user: ${targetsBlock(input.goals)}
    ${input.preferences?.trim() ? `PREFERENSI USER: "${input.preferences.trim()}"` : ""}
    ${dislikesBlock(input.dislikes)}

    Aturan:
    - Kasih SATU komponen pengganti yang PERANNYA SAMA (lauk diganti lauk, karbo diganti karbo, sayur diganti sayur, minuman diganti minuman).
    - Kalorinya mirip komponen lama (selisih maks ~25%), biar total menu gak jauh meleset.
    - JANGAN kasih yang sama/mirip dengan "${target.name}" — user minta ganti.
    - JANGAN duplikat komponen yang sudah ada di daftar "tetap" di atas.
    - Makanan Indonesia yang gampang didapat/dibuat. Sertakan takaran di nama (mis. "Tempe orek 100g").

    Balas HANYA JSON valid (tanpa markdown/backtick):
    ${ITEM_SHAPE}
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  return { item: cleanItem(JSON.parse(cleanJson)), usage: readUsage(result.response) };
}

/** Pecah menu lama (yang belum punya komponen) jadi komponen-komponen. */
export async function splitIntoComponents(input: {
  meal: PlannedMeal;
}): Promise<{ items: PlannedItem[] | null; usage?: AiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const m = input.meal;

  const prompt = `
    Pecah menu Indonesia ini jadi komponen-komponen penyusunnya (lauk, karbo, sayur, minuman).

    Menu: "${m.name}" — ${m.portion}
    Total gizi: ${m.kcal} kkal, protein ${m.protein_g} g, karbo ${m.carbs_g} g, lemak ${m.fat_g} g

    Aturan:
    - Bagi makro total ke tiap komponen secara realistis. Jumlah makro semua komponen HARUS = total di atas.
    - Sertakan takaran di nama komponen (mis. "Nasi putih 150g").
    - Kalau menunya emang tunggal, balikin 1 komponen aja.

    Balas HANYA JSON valid (tanpa markdown/backtick): array of ${ITEM_SHAPE}
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanJson);
  const items = Array.isArray(parsed)
    ? parsed.map(cleanItem).filter((x): x is PlannedItem => !!x).slice(0, 8)
    : null;
  return { items: items && items.length > 0 ? items : null, usage: readUsage(result.response) };
}
