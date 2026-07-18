import { GoogleGenerativeAI } from "@google/generative-ai";
import { AiUsage, GEMINI_MODEL } from "@/lib/ai-pricing";
import { readUsage } from "@/lib/ai-extract";

/** Satu gerakan alternatif buat panduan latihan. */
export type WorkoutAlt = {
  name: string;
  /** Otot utama yang dilatih (singkat). */
  targets: string;
  /** Cara singkat ngelakuin. */
  howto: string;
  /** Saran set × rep, mis. "3 × 10-12". */
  setsReps: string;
  /** Kenapa gerakan ini cocok sama konteks/alasan user. */
  reason: string;
};

// Cari alternatif gerakan buat panduan latihan (halaman Jadwal Olahraga).
// User kasih alasan/konteks (mis. "gak ada pull bar", "bahu sakit") + gerakan
// yang mau diganti (opsional). AI kasih 3 alternatif yang menghargai konteksnya.
export async function suggestWorkoutAlternatives(input: {
  reason: string;
  target?: string;
}): Promise<{ alternatives: WorkoutAlt[]; usage?: AiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const target = input.target?.trim();
  const prompt = `
    You are an Indonesian calisthenics & strength coach. The user is on a fat-loss cut
    (75kg → 68kg) while keeping muscle, training mostly BODYWEIGHT (default gear: pull bar +
    ransel buat nambah beban). Their usual full-body movements: pull-up/chin-up, push-up,
    inverted row, bulgarian split squat, glute bridge / hip thrust, hanging leg raise, plank.

    The user wants ALTERNATIVE exercises for their guide.
    ${target ? `- Gerakan yang mau diganti: "${target}".` : "- Gerakan yang mau diganti: bebas / sesi umum."}
    - Alasan/konteks kenapa butuh alternatif: "${input.reason}".

    Rules:
    - HORMATI alasannya. Kalau "gak ada pull bar" → jangan kasih gerakan yang butuh pull bar.
      Kalau "bahu sakit" / cedera → hindari beban ke area itu. Kalau "di hotel / gak ada alat" →
      pilih yang murni bodyweight tanpa alat. Kalau "bosen / variasi" → kasih variasi yang lebih fresh.
    - Kalau ada gerakan target spesifik, latih otot yang mirip (mis. pengganti pull-up harus tetap kena punggung).
    - Utamakan yang alatnya minim dan aman buat pemula–menengah.

    Return ONLY a valid JSON array (no markdown, no backticks) of exactly 3 objects:
    [{ "name": string (nama gerakan, bahasa Indonesia),
       "targets": string (otot utama, singkat mis. "Punggung, biceps"),
       "howto": string (cara singkat 1-2 kalimat, Indonesia santai),
       "setsReps": string (mis. "3 × 10-12" atau "3 × 30 detik"),
       "reason": string (1 kalimat kenapa cocok sama konteks user) }]
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanJson);
  if (!Array.isArray(parsed)) throw new Error("workout-advisor: unexpected response shape");

  const alternatives: WorkoutAlt[] = parsed.slice(0, 3).map((a) => ({
    name: String(a.name || "Gerakan").slice(0, 80),
    targets: String(a.targets || "").slice(0, 80),
    howto: String(a.howto || "").slice(0, 240),
    setsReps: String(a.setsReps || "").slice(0, 40),
    reason: String(a.reason || "").slice(0, 200),
  }));
  return { alternatives, usage: readUsage(result.response) };
}
