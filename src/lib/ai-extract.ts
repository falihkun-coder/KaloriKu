import { GoogleGenerativeAI } from "@google/generative-ai";
import { MealType } from "@/lib/calculations";

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
};

export type ExtractInput = {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  caption?: string;
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

  const prompt = `
    You are an expert Indonesian nutritionist. Analyze the ${input.imageBase64 ? "food image (or nutrition label photo)" : "food description"} and estimate its nutrition.

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
    confidence (number 0-1).
  `;

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];
  if (input.imageBase64) {
    parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType || "image/jpeg" } });
  }

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanJson);

  const meal: MealType = VALID_MEALS.includes(parsed.meal) ? parsed.meal : currentMealWIB();
  return {
    name: String(parsed.name || "Makanan").slice(0, 80),
    kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
    protein_g: Math.max(0, Math.round((Number(parsed.protein_g) || 0) * 10) / 10),
    carbs_g: Math.max(0, Math.round((Number(parsed.carbs_g) || 0) * 10) / 10),
    fat_g: Math.max(0, Math.round((Number(parsed.fat_g) || 0) * 10) / 10),
    portion: String(parsed.portion || "1 porsi").slice(0, 40),
    meal,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
  };
}
