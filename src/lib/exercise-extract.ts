import { ExerciseType } from "@/lib/calculations";
import { AiUsage } from "@/lib/ai-pricing";
import { generate, parseModelJson } from "@/lib/gemini";

export type ExtractedExercise = {
  name: string;
  type: ExerciseType;
  durationMin: number;
  kcalBurned: number;
  confidence: number;
  usage?: AiUsage;
};

const VALID_TYPES: ExerciseType[] = ["kardio", "beban", "hiit", "jalan", "lainnya"];

// Estimasi kalori terbakar dari deskripsi olahraga — shared web & bot.
// Berat badan (kalau ada di weights terakhir) bikin estimasi lebih akurat.
export async function estimateExercise(text: string, weightKg?: number): Promise<ExtractedExercise> {
  const prompt = `
    You are a fitness coach. Estimate calories burned for this Indonesian workout description: "${text}".
    ${weightKg ? `The person weighs about ${weightKg} kg — use it for a realistic estimate.` : "Assume ~70 kg if weight is unknown."}

    Rules:
    - Use MET-based realistic estimates for common activities (lari, jalan, gym/angkat beban, sepeda, renang, HIIT, futsal, badminton, yoga, etc.).
    - If duration is given, use it; otherwise assume a typical session and note it in the name.
    - type: one of "kardio" (running/cycling/swimming), "beban" (weight lifting/gym), "hiit", "jalan" (walking/jogging), "lainnya".

    Return ONLY a valid JSON object (no markdown, no backticks) with keys:
    name (string, nama olahraga singkat bahasa Indonesia),
    type (one of: "kardio", "beban", "hiit", "jalan", "lainnya"),
    durationMin (number, menit),
    kcalBurned (number),
    confidence (number 0-1).
  `;

  const result = await generate({ task: "exercise", prompt });
  const parsed = parseModelJson<{
    name?: unknown;
    type?: unknown;
    durationMin?: unknown;
    kcalBurned?: unknown;
    confidence?: unknown;
  }>(result.text);

  const type: ExerciseType = VALID_TYPES.includes(parsed.type as ExerciseType) ? (parsed.type as ExerciseType) : "lainnya";
  return {
    name: String(parsed.name || "Olahraga").slice(0, 80),
    type,
    durationMin: Math.max(0, Math.round(Number(parsed.durationMin) || 0)),
    kcalBurned: Math.max(0, Math.round(Number(parsed.kcalBurned) || 0)),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    usage: result.usage,
  };
}
