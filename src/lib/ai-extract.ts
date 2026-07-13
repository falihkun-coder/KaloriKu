import { GoogleGenerativeAI } from "@google/generative-ai";
import { MealType, MealItem } from "@/lib/calculations";
import { AiUsage } from "@/lib/ai-pricing";

export type ExtractedFood = {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  meal: MealType;
  /** 0–1: label nutrisi ≈ tinggi, estimasi foto/teks ≈ lebih rendah */
  confidence: number;
  /** Breakdown per item untuk paket/combo — biar user bisa cek referensi AI */
  items?: MealItem[];
  /** Token in/out buat tracking biaya (server yang catat) */
  usage?: AiUsage;
};

// Ambil token in/out dari respons Gemini buat tracking biaya.
export function readUsage(resp: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): AiUsage | undefined {
  const um = resp.usageMetadata;
  if (!um) return undefined;
  return { inputTokens: um.promptTokenCount || 0, outputTokens: um.candidatesTokenCount || 0 };
}

export type ExtractInput = {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  caption?: string;
  /** Voice note (mis. Telegram: audio/ogg) — transkrip + estimasi sekaligus */
  audioBase64?: string;
  audioMimeType?: string;
};

function currentMealWIB(): MealType {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
  );
  if (hour < 11) return "sarapan";
  if (hour < 15) return "siang";
  if (hour < 18) return "snack";
  if (hour < 22) return "malam";
  return "snack";
}

const VALID_MEALS: MealType[] = ["sarapan", "siang", "malam", "snack"];

// Satu fungsi extract untuk web /scan, Telegram, dan (nanti) Discord — biar
// estimasi nutrisi konsisten di semua surface (brief §08).
export async function extractFood(input: ExtractInput): Promise<ExtractedFood> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const inputKind = input.imageBase64
    ? "food image (or nutrition label photo)"
    : input.audioBase64
      ? "Indonesian voice note describing what the user ate (transcribe it first, then estimate)"
      : "food description";

  const prompt = `
    You are an expert Indonesian nutritionist. Analyze the ${inputKind} and estimate its nutrition.

    Rules:
    - Common Indonesian foods (nasi goreng, ayam geprek, bakso, etc.): estimate realistic values for the stated portion. Default portion "1 porsi" if unstated.
    - If the image is a NUTRITION LABEL: read the numbers directly (per serving) and set confidence high (0.9+).
    - If it's a food photo or free text: estimate, confidence 0.5–0.8 depending on clarity.
    - kcal should be roughly consistent with macros (protein*4 + carbs*4 + fat*9).
    - meal: infer from context; if unclear use "${currentMealWIB()}" (current time in Jakarta).
    ${input.caption ? `- USER CONTEXT/CAPTION: "${input.caption}" — prioritize it for portion and meal.` : ""}
    ${input.text ? `- Food description: "${input.text}"` : ""}

    Return ONLY a valid JSON object (no markdown, no backticks) with keys:
    name (string, nama makanan singkat dalam bahasa Indonesia),
    kcal (number), protein_g (number), carbs_g (number), fat_g (number),
    portion (string, e.g. "1 porsi", "2 potong", "300 ml"),
    meal (one of: "sarapan", "siang", "malam", "snack"),
    confidence (number 0-1),
    items (OPTIONAL array — ONLY when the food is a combo/paket/set or multiple foods:
      [{ "name": string in Indonesian INCLUDING quantity e.g. "2 ayam goreng" / "nasi large" / "cola medium", "kcal": number }].
      The per-item kcal MUST sum up to the total kcal. Omit items entirely for a single simple food.)
  `;

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];
  if (input.imageBase64) {
    parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType || "image/jpeg" } });
  }
  if (input.audioBase64) {
    parts.push({ inlineData: { data: input.audioBase64, mimeType: input.audioMimeType || "audio/ogg" } });
  }

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanJson);

  const meal: MealType = VALID_MEALS.includes(parsed.meal) ? parsed.meal : currentMealWIB();

  // Breakdown per item: total selalu = jumlah item biar angkanya bisa dicek user
  let items: MealItem[] | undefined;
  if (Array.isArray(parsed.items) && parsed.items.length > 1) {
    items = parsed.items
      .map((it: { name?: unknown; kcal?: unknown }) => ({
        name: String(it.name || "Item").slice(0, 60),
        kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
      }))
      .filter((it: MealItem) => it.kcal > 0)
      .slice(0, 12);
    if (items && items.length < 2) items = undefined;
  }
  const totalKcal = items
    ? items.reduce((s, it) => s + it.kcal, 0)
    : Math.max(0, Math.round(Number(parsed.kcal) || 0));

  return {
    name: String(parsed.name || "Makanan").slice(0, 80),
    kcal: totalKcal,
    protein_g: Math.max(0, Math.round((Number(parsed.protein_g) || 0) * 10) / 10),
    carbs_g: Math.max(0, Math.round((Number(parsed.carbs_g) || 0) * 10) / 10),
    fat_g: Math.max(0, Math.round((Number(parsed.fat_g) || 0) * 10) / 10),
    portion: String(parsed.portion || "1 porsi").slice(0, 40),
    meal,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    ...(items && { items }),
    usage: readUsage(result.response),
  };
}
