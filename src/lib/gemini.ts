import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { AiUsage, AI_MODELS, AI_THINKING } from "@/lib/ai-pricing";

export type AiTask = keyof typeof AI_MODELS;

// Server-only. Satu pintu buat semua panggilan Gemini: bikin client, baca pemakaian token
// (termasuk thinking & hasil search yang ikut ditagih), dan ambil sumber grounding.

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export type GroundingSource = { title: string; uri: string };

export type GeminiResult = {
  text: string;
  usage: AiUsage;
  /** Halaman web yang dipakai kalau grounded */
  sources: GroundingSource[];
  /**
   * HTML "Search Suggestions" dari Google. Kalau hasil grounded ditampilin ke user, ini WAJIB
   * ikut ditampilin (Gemini API Terms) — dan link-nya gak boleh diubah atau disimpan.
   */
  searchSuggestionsHtml?: string;
};

export async function generate(opts: {
  /** Nama tugas — model & level thinking-nya diatur di ai-pricing.ts */
  task: AiTask;
  prompt: string;
  /** Gambar / audio (base64) */
  media?: { data: string; mimeType: string }[];
  /** Pakai Google Search buat cari data terkini/resmi (5.000 request gratis per bulan) */
  grounded?: boolean;
}): Promise<GeminiResult> {
  const model = AI_MODELS[opts.task];
  const parts: Part[] = [{ text: opts.prompt }];
  for (const m of opts.media || []) parts.push({ inlineData: { data: m.data, mimeType: m.mimeType } });

  const response = await getClient().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel[AI_THINKING[opts.task]] },
      // Mode JSON bikin parsing andal — tapi kalau digabung grounding, Google gak ngirim sumber &
      // Search Suggestions (dites). Jadi grounded pakai teks biasa, JSON-nya diambil manual.
      ...(opts.grounded ? { tools: [{ googleSearch: {} }] } : { responseMimeType: "application/json" }),
    },
  });

  const um = response.usageMetadata;
  const thinking = um?.thoughtsTokenCount || 0;
  const usage: AiUsage = {
    model,
    inputTokens: (um?.promptTokenCount || 0) + (um?.toolUsePromptTokenCount || 0),
    outputTokens: (um?.candidatesTokenCount || 0) + thinking,
    thinkingTokens: thinking,
    grounded: !!opts.grounded,
  };

  const gm = response.candidates?.[0]?.groundingMetadata;
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of gm?.groundingChunks || []) {
    const w = chunk.web;
    if (!w?.uri || seen.has(w.uri)) continue;
    seen.add(w.uri);
    sources.push({ title: w.title || w.domain || "Sumber", uri: w.uri });
  }

  return {
    text: response.text || "",
    usage,
    sources,
    ...(gm?.searchEntryPoint?.renderedContent && { searchSuggestionsHtml: gm.searchEntryPoint.renderedContent }),
  };
}

/**
 * Ambil JSON dari jawaban model. Tahan sama code fence dan teks penjelasan sebelum JSON
 * (jawaban grounded selalu begitu — dan teksnya bisa ngandung "[...]" penanda sumber).
 */
export function parseModelJson<T = unknown>(text: string): T {
  // Blok ```json``` paling akhir dulu, baru teks utuh.
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim()).reverse();
  for (const candidate of [...fenced, text.trim()]) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Potong ke blok terluar — object dulu, baru array.
      for (const [open, close] of [
        ["{", "}"],
        ["[", "]"],
      ]) {
        const start = candidate.indexOf(open);
        const end = candidate.lastIndexOf(close);
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(candidate.slice(start, end + 1)) as T;
          } catch {
            /* coba bentuk berikutnya */
          }
        }
      }
    }
  }
  throw new Error("Jawaban AI bukan JSON");
}
