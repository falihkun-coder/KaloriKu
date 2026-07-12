import { Goals, MacroTotals, fmtNum, remaining } from "@/lib/calculations";

// Kandidat makanan yang mau dicek "muat gak di target?"
export type FitCandidate = {
  name?: string;
  kcal: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export type FitVerdictLevel = "safe" | "caution" | "danger";

export type FitResult = {
  name: string;
  candidate: Required<Omit<FitCandidate, "name">>;
  /** sisa kalori sebelum makan kandidat */
  beforeKcal: number;
  /** sisa kalori setelah makan kandidat (negatif = over) */
  afterKcal: number;
  /** persen target kalori terpakai setelah makan kandidat */
  pctAfter: number;
  /** makro yang bakal kelewat target */
  macroOver: string[];
  level: FitVerdictLevel;
  label: string;
  advice: string;
};

// Satu sumber vonis "muat gak?" — dipakai web simulator dan bot Telegram
// biar keduanya menghakimi dengan cara yang sama persis. burned = kkal
// olahraga yang nambah budget (net kalori).
export function simulateFit(
  goals: Goals,
  consumedToday: MacroTotals,
  candidate: FitCandidate,
  burned = 0
): FitResult {
  const c = {
    kcal: Math.max(0, Number(candidate.kcal) || 0),
    protein_g: Math.max(0, Number(candidate.protein_g) || 0),
    carbs_g: Math.max(0, Number(candidate.carbs_g) || 0),
    fat_g: Math.max(0, Number(candidate.fat_g) || 0),
  };

  const before = remaining(goals, consumedToday, burned);
  const afterKcal = before.kcal - c.kcal;
  const totalAfter = consumedToday.kcal + c.kcal;
  const pctAfter = before.effectiveTarget > 0 ? Math.round((totalAfter / before.effectiveTarget) * 100) : 0;

  const macroOver: string[] = [];
  if (goals.proteinTarget > 0 && consumedToday.protein_g + c.protein_g > goals.proteinTarget) macroOver.push("protein");
  if (goals.carbsTarget > 0 && consumedToday.carbs_g + c.carbs_g > goals.carbsTarget) macroOver.push("karbo");
  if (goals.fatTarget > 0 && consumedToday.fat_g + c.fat_g > goals.fatTarget) macroOver.push("lemak");

  let level: FitVerdictLevel;
  let label: string;
  let advice: string;

  if (afterKcal >= 0 && macroOver.length === 0) {
    level = "safe";
    label = "MUAT";
    advice = `Aman — habis ini masih sisa ${fmtNum(afterKcal)} kkal buat hari ini.`;
  } else if (pctAfter <= 110) {
    level = "caution";
    label = "NGEPAS";
    advice =
      macroOver.length > 0 && afterKcal >= 0
        ? `Kalori muat, tapi ${macroOver.join(" & ")} bakal lewat target. Kurangi porsi atau tukar menu.`
        : `Bakal lewat dikit (${pctAfter}% target). Kalau makan ini, sisanya hari ini kudu ringan.`;
  } else {
    level = "danger";
    label = "GAK MUAT";
    advice = `Bakal ${fmtNum(Math.abs(afterKcal))} kkal di atas target (${pctAfter}%). Mending porsi kecil atau simpan buat besok.`;
  }

  return {
    name: candidate.name || "Makanan",
    candidate: c,
    beforeKcal: before.kcal,
    afterKcal,
    pctAfter,
    macroOver,
    level,
    label,
    advice,
  };
}

const VERDICT_EMOJI: Record<FitVerdictLevel, string> = { safe: "🟢", caution: "🟠", danger: "🔴" };

// Balasan Telegram-ready untuk /muat.
export function formatFit(result: FitResult): string {
  let msg = `🧮 Muat gak: ${result.name}?\n`;
  msg += `≈ ${fmtNum(result.candidate.kcal)} kkal · P${fmtNum(result.candidate.protein_g)} K${fmtNum(result.candidate.carbs_g)} L${fmtNum(result.candidate.fat_g)}\n\n`;
  msg += `Sisa sekarang: ${fmtNum(result.beforeKcal)} kkal\n`;
  msg += `Kalau dimakan: ${result.afterKcal >= 0 ? `sisa ${fmtNum(result.afterKcal)}` : `over ${fmtNum(Math.abs(result.afterKcal))}`} kkal (${result.pctAfter}% target)\n\n`;
  msg += `${VERDICT_EMOJI[result.level]} ${result.label}\n${result.advice}`;
  return msg;
}
