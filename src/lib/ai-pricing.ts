// Client-safe (tanpa firebase-admin) — dipakai server (nyatet biaya) & UI (nampilin biaya).

/** Pemakaian 1 request AI. */
export type AiUsage = {
  model: string;
  /** prompt + hasil tool (mis. halaman hasil Google Search) — ditagih sebagai input */
  inputTokens: number;
  /** jawaban + thinking — dua-duanya ditagih sebagai output */
  outputTokens: number;
  thinkingTokens?: number;
  /** pakai Grounding with Google Search */
  grounded?: boolean;
};

// Model default semua fitur AI.
export const AI_MODEL = "gemini-4-argon";

// Model per tugas — mau geser tugas ringan ke model lebih murah? cukup ganti di sini.
export const AI_MODELS = {
  /** chat/foto/voice → nutrisi (scan web, menu resto, bot) */
  foodExtract: AI_MODEL,
  /** estimasi kalori olahraga */
  exercise: AI_MODEL,
  /** saran menu dari sisa kalori */
  advisor: AI_MODEL,
  /** rencana mingguan, ganti slot/komponen, pecah komponen */
  mealPlan: AI_MODEL,
  /** alternatif latihan */
  workout: AI_MODEL,
} as const;

// Seberapa dalam AI "mikir" per tugas. Di Argon ini ngefek GEDE ke waktu tunggu (dites 20 Okt 2026:
// tugas yang sama 27 detik di level default vs 6 detik di LOW) — sementara request lewat Firebase
// Hosting dipotong di 60 detik. MINIMAL gak didukung Argon.
export type ThinkingDepth = "LOW" | "MEDIUM" | "HIGH";
export const AI_THINKING: Record<keyof typeof AI_MODELS, ThinkingDepth> = {
  foodExtract: "LOW",
  exercise: "LOW",
  advisor: "LOW",
  mealPlan: "LOW",
  workout: "LOW",
};

// Tarif resmi Gemini API paid tier (USD per 1 juta token), dari
// ai.google.dev/gemini-api/docs/pricing — dicek 20 Okt 2026. Output = jawaban + thinking.
// Tiap model boleh punya beberapa entri; yang dipakai entri terakhir yang `from` <= tanggal
// request, jadi kenaikan harga terjadwal otomatis kehitung tanpa ngubah kode.
type Rate = { from: string; inputUsd: number; outputUsd: number };
const FLASH_RATES: Rate[] = [
  { from: "2000-01-01", inputUsd: 0.75, outputUsd: 3.75 },
  { from: "2027-01-01", inputUsd: 1.5, outputUsd: 7.5 },
];
const RATES: Record<string, Rate[]> = {
  "gemini-4-argon": [
    { from: "2000-01-01", inputUsd: 2, outputUsd: 10 },
    { from: "2026-12-01", inputUsd: 4, outputUsd: 20 },
  ],
  "gemini-3.8-flash": FLASH_RATES,
  "gemini-3.6-flash": FLASH_RATES,
  // Udah deprecated — Google ngalihin request-nya ke 3.6-flash.
  "gemini-3.5-flash": FLASH_RATES,
  "gemini-3.5-flash-lite": [{ from: "2000-01-01", inputUsd: 0.3, outputUsd: 2.5 }],
};

/** Tarif yang berlaku buat model di tanggal tertentu (model gak dikenal → tarif AI_MODEL). */
export function rateFor(model: string, at: Date = new Date()): Rate {
  const list = RATES[model] || RATES[AI_MODEL];
  const day = at.toISOString().slice(0, 10);
  let pick = list[0];
  for (const r of list) if (r.from <= day) pick = r;
  return pick;
}

/** Perubahan tarif terjadwal berikutnya buat model ini (null kalau gak ada). */
export function nextRateChange(model: string, at: Date = new Date()): Rate | null {
  const day = at.toISOString().slice(0, 10);
  return (RATES[model] || []).find((r) => r.from > day) || null;
}

/** Biaya (USD) satu request pakai tarif yang berlaku saat itu. */
export function costUsd(usage: Pick<AiUsage, "model" | "inputTokens" | "outputTokens">, at: Date = new Date()): number {
  const r = rateFor(usage.model, at);
  return (usage.inputTokens / 1_000_000) * r.inputUsd + (usage.outputTokens / 1_000_000) * r.outputUsd;
}

// Grounding with Google Search: 5.000 request gratis per bulan (dibagi semua model Gemini 3+),
// lewat dari itu $14 per 1.000.
export const GROUNDING_FREE_PER_MONTH = 5000;

/** Kunci bulan buat kuota grounding, mis. "2026-10" (UTC — kuota Google per bulan kalender). */
export function monthKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 7);
}

// Request lama sebelum biaya dicatat per request: semua jalan di 3.5-flash (dialihin ke 3.6-flash)
// dan token thinking-nya belum kecatat — jadi estimasinya cuma perkiraan bawah.
export const LEGACY_MODEL = "gemini-3.6-flash";

// Kurs USD→IDR buat tampilan.
export const USD_TO_IDR = 16300;

/** Format rupiah dengan desimal (biaya bisa < Rp1). */
export function fmtIdr(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}
