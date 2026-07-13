import { GoogleGenerativeAI } from "@google/generative-ai";
import { Goals, MacroTotals, remaining, fmtNum } from "@/lib/calculations";
import { AiUsage } from "@/lib/ai-pricing";
import { readUsage } from "@/lib/ai-extract";

export type MealSuggestion = {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  reason: string;
};

// Saran menu dari sisa kalori/macro hari ini (brief §07 /api/advisor) —
// shared web (card dashboard) & Telegram (/saran) biar sarannya konsisten.
export async function suggestMeals(
  goals: Goals,
  consumedToday: MacroTotals,
  burned = 0
): Promise<{ suggestions: MealSuggestion[]; usage?: AiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const r = remaining(goals, consumedToday, burned);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are a friendly Indonesian nutritionist. The user has these targets LEFT for today:
    - Calories: ${r.kcal} kcal ${r.kcal < 0 ? "(ALREADY OVER TARGET)" : ""}
    - Protein: ${Math.round(r.protein_g)} g, Carbs: ${Math.round(r.carbs_g)} g, Fat: ${Math.round(r.fat_g)} g

    Suggest exactly 3 realistic Indonesian meals/snacks that fit the remaining budget.
    Rules:
    - Prioritize filling the macro that's furthest from target (esp. protein if remaining protein is high).
    - If calories remaining < 200 (or negative), suggest very light/zero options (air putih, buah, sayur rebus, teh tawar) and keep kcal small.
    - Use common warung/rumahan foods with realistic portions.
    - reason: one short sentence in casual Indonesian explaining why it fits.

    Return ONLY a valid JSON array (no markdown, no backticks) of exactly 3 objects:
    [{ "name": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "reason": string }]
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanJson);
  if (!Array.isArray(parsed)) throw new Error("advisor: unexpected response shape");

  const suggestions = parsed.slice(0, 3).map((s) => ({
    name: String(s.name || "Menu").slice(0, 80),
    kcal: Math.max(0, Math.round(Number(s.kcal) || 0)),
    protein_g: Math.max(0, Math.round((Number(s.protein_g) || 0) * 10) / 10),
    carbs_g: Math.max(0, Math.round((Number(s.carbs_g) || 0) * 10) / 10),
    fat_g: Math.max(0, Math.round((Number(s.fat_g) || 0) * 10) / 10),
    reason: String(s.reason || "").slice(0, 160),
  }));
  return { suggestions, usage: readUsage(result.response) };
}

// Balasan Telegram-ready untuk /saran.
export function formatSuggestions(suggestions: MealSuggestion[], remainingKcal: number): string {
  let msg =
    remainingKcal >= 0
      ? `🍽️ Sisa ${fmtNum(remainingKcal)} kkal — saran menu:\n`
      : `🍽️ Udah lewat target ${fmtNum(Math.abs(remainingKcal))} kkal — opsi ringan:\n`;
  suggestions.forEach((s, i) => {
    msg += `\n${i + 1}. ${s.name} (≈${fmtNum(s.kcal)} kkal · P${fmtNum(s.protein_g)})\n   ${s.reason}`;
  });
  return msg;
}
