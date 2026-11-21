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

type GenerateOpts = {
  /** Nama tugas — model & level thinking-nya diatur di ai-pricing.ts */
  task: AiTask;
  prompt: string;
  /** Gambar / audio (base64) */
  media?: { data: string; mimeType: string }[];
  /** Pakai Google Search buat cari data terkini/resmi (5.000 request gratis per bulan) */
  grounded?: boolean;
};

// ===== Model cadangan =====
// Model utama (Argon) bisa tumbang pas Google lagi penuh — 21 Nov 2026 dites: Argon 503 "high demand"
// lalu timeout 60 dtk, sementara 3.6 Flash 11 dtk & 3.5 Flash-Lite 1 dtk. Daripada semua fitur AI
// ikut gagal, pindah otomatis ke model cadangan. Biaya tetap kecatat pakai model yang beneran dipakai.
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

// Batas waktu SATU percobaan per tugas. Rencana mingguan emang panjang (Argon normalnya ~97 dtk).
const ATTEMPT_TIMEOUT_MS: Record<AiTask, number> = {
  foodExtract: 45_000,
  exercise: 30_000,
  advisor: 40_000,
  workout: 40_000,
  mealPlan: 150_000,
};
// Total semua percobaan — function-nya timeout 300 dtk, sisain buat nyimpen hasil & bales.
const TOTAL_BUDGET_MS = 240_000;
// Model yang barusan gagal dilewatin dulu, biar request berikutnya gak ikut nunggu timeout.
const COOLDOWN_MS = 10 * 60_000;
const downUntil = new Map<string, number>();

/** Error sementara dari sisi Google (penuh / kelamaan) → layak dicoba ke model lain. */
function isTransient(e: unknown): boolean {
  const err = e as { status?: unknown; name?: unknown } | null;
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return true;
  return typeof err?.status === "number" && (err.status === 408 || err.status === 429 || err.status >= 500);
}

function describeError(e: unknown): string {
  const err = e as { status?: unknown; name?: unknown } | null;
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return "timeout";
  return typeof err?.status === "number" ? `HTTP ${err.status}` : String(err?.name || "error");
}

export async function generate(opts: GenerateOpts): Promise<GeminiResult> {
  const primary = AI_MODELS[opts.task];
  const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown = new Error("Semua model AI gagal");

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const isLast = i === chain.length - 1;
    // Yang lagi "istirahat" dilewatin — kecuali cadangan terakhir, itu selalu dicoba.
    if (!isLast && (downUntil.get(model) || 0) > Date.now()) continue;
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;

    try {
      const result = await callModel(model, opts, Math.min(ATTEMPT_TIMEOUT_MS[opts.task], remaining));
      if (model !== primary) console.warn(`gemini: ${opts.task} dijawab model cadangan ${model}`);
      return result;
    } catch (e) {
      lastError = e;
      // Saldo habis (402), request salah (400), dll: ganti model gak bakal nolong.
      if (!isTransient(e)) throw e;
      downUntil.set(model, Date.now() + COOLDOWN_MS);
      console.warn(`gemini: ${model} gagal (${describeError(e)}) buat ${opts.task} — coba model cadangan`);
    }
  }
  throw lastError;
}

async function callModel(model: string, opts: GenerateOpts, timeoutMs: number): Promise<GeminiResult> {
  const parts: Part[] = [{ text: opts.prompt }];
  for (const m of opts.media || []) parts.push({ inlineData: { data: m.data, mimeType: m.mimeType } });

  const response = await getClient().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      httpOptions: { timeout: timeoutMs },
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
 * Kalau gagalnya dari sisi layanan AI (saldo habis / kena kuota), balikin pesan yang jelas buat user —
 * biar gak disangka fotonya yang salah. null = error biasa, pakai pesan fallback masing-masing.
 */
export function aiServiceProblem(e: unknown): string | null {
  const status = (e as { status?: unknown } | null)?.status;
  const msg = e instanceof Error ? e.message : String(e);
  // 402 dicek duluan: statusnya juga "RESOURCE_EXHAUSTED", tapi artinya saldo prabayar habis.
  if (status === 402 || /prepayment credits are depleted/i.test(msg)) {
    return "⚠️ Saldo AI (Gemini) lagi habis, jadi scan & hitung otomatis belum bisa. Top up dulu di AI Studio → Billing: https://ai.studio/projects\n\nSementara itu masih bisa /favorit atau catat manual di web.";
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return "⏳ AI lagi kena batas pemakaian. Coba lagi beberapa menit lagi ya.";
  }
  // Sampai sini berarti model cadangan juga udah dicoba (generate() pindah model otomatis).
  if (isTransient(e)) {
    return "⏳ Server AI Google lagi penuh banget — model utama & cadangan sama-sama gak bales. Coba lagi beberapa menit lagi ya.\n\nSementara itu masih bisa /favorit atau catat manual di web.";
  }
  return null;
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
