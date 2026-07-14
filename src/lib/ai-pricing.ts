// Client-safe (tanpa firebase-admin) — dipakai UI buat estimasi biaya AI.
export type AiUsage = { inputTokens: number; outputTokens: number };

// Satu-satunya tempat nentuin model Gemini — semua fitur AI nyontek dari sini.
// Ganti model? cukup edit baris ini.
export const GEMINI_MODEL = "gemini-3.5-flash";

export type AiUsageStats = {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
};

// Tarif Gemini Flash (USD per 1 juta token). ESTIMASI — sumber kebenaran tetap
// Google Cloud Billing (ada porsi gratis, diskon cache, tarif audio beda).
// Kalau ganti model (GEMINI_MODEL), cek & sesuaikan tarif di bawah kalau beda.
export const GEMINI_FLASH_INPUT_USD_PER_M = 0.3;
export const GEMINI_FLASH_OUTPUT_USD_PER_M = 2.5;

// Kurs USD→IDR buat konversi tampilan. Sesuaikan di sini kalau perlu.
export const USD_TO_IDR = 16300;

/** Estimasi biaya (IDR) dari jumlah token in/out. */
export function estimateCostIdr(
  inputTokens: number,
  outputTokens: number,
  usdToIdr = USD_TO_IDR
): number {
  const usd =
    (inputTokens / 1_000_000) * GEMINI_FLASH_INPUT_USD_PER_M +
    (outputTokens / 1_000_000) * GEMINI_FLASH_OUTPUT_USD_PER_M;
  return usd * usdToIdr;
}

/** Format rupiah dengan desimal (biaya bisa < Rp1). */
export function fmtIdr(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}
