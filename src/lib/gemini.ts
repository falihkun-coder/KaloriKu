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
// Model utama bisa tumbang pas Google lagi penuh — 21 Nov 2026 Argon 503 "high demand" lalu timeout
// 60 dtk; 23 Nov 2026 Neon & Hydrogen 503 terus selama 2,5 menit, cuma 3.5 Flash-Lite yang hidup.
// Daripada semua fitur AI ikut gagal, pindah otomatis ke model cadangan (urut dari yang paling
// pinter). Biaya tetap kecatat pakai model yang beneran jawab.
const FALLBACK_MODELS = ["gemini-4-hydrogen", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

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
// Cadangan terakhir dicoba ulang dulu sebelum nyerah: pas Google penuh, 503-nya putus-nyambung
// (23 Nov 2026: Flash-Lite 503, belasan detik kemudian jalan lagi). Tier "priority" yang lebih
// mahal juga udah dites — Neon tetap 503, jadi gak usah bayar lebih.
const LAST_MODEL_RETRY_DELAYS_MS = [2_000, 4_000, 8_000];
// Sisa waktu minimal biar satu percobaan masih masuk akal.
const MIN_ATTEMPT_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Error sementara dari sisi Google (penuh / kelamaan). */
function isTransient(e: unknown): boolean {
  const err = e as { status?: unknown; name?: unknown } | null;
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return true;
  return typeof err?.status === "number" && (err.status === 408 || err.status === 429 || err.status >= 500);
}

/** Ditolak cepet karena Google lagi penuh / kena limit sesaat — layak dicoba ulang bentar lagi. */
function isOverloaded(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === "number" && (status === 429 || status >= 500);
}

/**
 * Layak dicoba ke model lain? Ya, KECUALI masalahnya di key/saldo (401/402/403) — semua model
 * pakai key & saldo yang sama, jadi pindah model gak nolong. Penolakan khusus model (mis. 400/404
 * karena model baru gak nerima sebuah setting) tetap dicoba ke cadangan.
 */
function canFallback(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return !(status === 401 || status === 402 || status === 403);
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
    const retryDelays = isLast ? LAST_MODEL_RETRY_DELAYS_MS : [];

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      const wait = attempt > 0 ? retryDelays[attempt - 1] : 0;
      if (deadline - Date.now() < wait + MIN_ATTEMPT_MS) throw lastError;
      if (wait) await sleep(wait);
      const remaining = deadline - Date.now();

      try {
        const result = await callModel(model, opts, Math.min(ATTEMPT_TIMEOUT_MS[opts.task], remaining));
        if (model !== primary) {
          const retried = attempt > 0 ? ` (percobaan ke-${attempt + 1})` : "";
          console.warn(`gemini: ${opts.task} dijawab model cadangan ${model}${retried}`);
        }
        return result;
      } catch (e) {
        lastError = e;
        if (!canFallback(e)) throw e;
        // Dijeda cuma kalau modelnya yang bermasalah (penuh/timeout/gak ada) — 400 bisa jadi
        // gara-gara isi request-nya, jadi jangan bikin model utama dilewatin 10 menit.
        if (isTransient(e) || (e as { status?: unknown } | null)?.status === 404) {
          downUntil.set(model, Date.now() + COOLDOWN_MS);
        }
        // Diulang cuma kalau ditolak cepet karena penuh. Timeout udah makan banyak waktu, dan
        // error lain gak bakal berubah kalau diulang.
        const retrying = attempt < retryDelays.length && isOverloaded(e);
        const next = retrying
          ? `coba lagi ${retryDelays[attempt] / 1000} dtk lagi`
          : isLast
            ? "semua model gagal"
            : "coba model cadangan";
        console.warn(`gemini: ${model} gagal (${describeError(e)}) buat ${opts.task} — ${next}`);
        if (!retrying) break;
      }
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
  // 403 "outstanding balance" (27 Nov 2026): ada tagihan Google yang belum dibayar, semua model
  // diblokir. Beda sama saldo habis — ini dilunasin lewat "Make a payment", bukan beli kredit.
  if (/outstanding balance/i.test(msg)) {
    return "⚠️ Akun billing Google lagi ada tagihan yang belum dibayar, jadi AI-nya diblokir Google. Lunasin dulu di AI Studio → Billing (Make a payment): https://aistudio.google.com/billing\n\nSementara itu masih bisa /favorit atau catat manual di web.";
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
