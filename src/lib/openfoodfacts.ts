// Lookup nutrisi produk kemasan dari barcode via Open Food Facts (gratis, publik,
// CORS-enabled — dipanggil langsung dari client, gak butuh AI/Gemini).

export type BarcodeProduct = {
  code: string;
  name: string;
  brand?: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  /** true = angka per 1 sajian; false = per 100 g/ml (user mesti sesuaikan porsi) */
  perServing: boolean;
};

const clampNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Cari produk dari barcode. Return null kalau barcode invalid, produk gak ada
 * di database, atau nutrisinya kosong.
 */
export async function lookupBarcode(rawCode: string): Promise<BarcodeProduct | null> {
  const code = rawCode.replace(/\D/g, "");
  if (code.length < 8) return null; // EAN-8/UPC-A/EAN-13 minimal 8 digit

  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_size`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      brands?: string;
      serving_size?: string;
      nutriments?: Record<string, unknown>;
    };
  };
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments || {};

  // Pilih basis: per-sajian kalau ada, kalau nggak per-100g
  const perServing = clampNum(n["energy-kcal_serving"]) > 0;
  const suffix = perServing ? "_serving" : "_100g";
  const kcal = Math.round(clampNum(n[`energy-kcal${suffix}`]));
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const protein_g = round1(clampNum(n[`proteins${suffix}`]));
  const carbs_g = round1(clampNum(n[`carbohydrates${suffix}`]));
  const fat_g = round1(clampNum(n[`fat${suffix}`]));

  // Kalau semua nutrisi 0, anggap gak ada data yang berguna
  if (kcal === 0 && protein_g === 0 && carbs_g === 0 && fat_g === 0) return null;

  const brand = p.brands ? String(p.brands).split(",")[0].trim() : undefined;
  const portion = perServing ? p.serving_size?.trim() || "1 sajian" : "100 g";

  return {
    code,
    name: String(p.product_name || "Produk").trim().slice(0, 80) || "Produk",
    brand: brand || undefined,
    kcal,
    protein_g,
    carbs_g,
    fat_g,
    portion,
    perServing,
  };
}
