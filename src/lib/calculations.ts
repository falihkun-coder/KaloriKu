// Domain rumus KaloriKu — pure functions, dipakai bareng web, bot, dan cron
// biar angka selalu konsisten (brief §02, §06).

export type MealType = "sarapan" | "siang" | "malam" | "snack";
export type EntrySource = "manual" | "chat" | "scan";

/** Komponen paket/combo (mis. "2 ayam goreng" 480 kkal) — bukti referensi AI. */
export type MealItem = {
  name: string;
  kcal: number;
};

export type FoodEntry = {
  id: string;
  userId?: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  meal: MealType;
  source: EntrySource;
  confidence?: number;
  photoUrl?: string;
  /** Breakdown per item kalau ini paket/combo */
  items?: MealItem[];
  createdAt: string; // ISO string
};

export type Goals = {
  userId?: string;
  kcalTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  weightTarget?: number;
  waterTargetMl?: number;
  activityLevel?: "rendah" | "sedang" | "tinggi";
};

export type WeightLog = {
  id: string;
  userId?: string;
  kg: number;
  date: string; // YYYY-MM-DD
};

export type WaterLog = {
  id: string;
  userId?: string;
  ml: number;
  date: string; // YYYY-MM-DD (WIB)
};

/** Makanan favorit di library — 1-tap log tanpa AI (brief §7 ide 2, §11 mitigasi biaya). */
export type SavedMeal = {
  id: string;
  userId?: string;
  name: string;
  /** Nama resto/warung kalau ini menu resto (diisi AI lookup) */
  restaurant?: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  /** Breakdown per item kalau ini paket/combo */
  items?: MealItem[];
  useCount?: number;
};

/** Label tampilan favorit: "Nama (Resto)" kalau ada restonya. */
export function mealLabel(m: Pick<SavedMeal, "name" | "restaurant">): string {
  return m.restaurant ? `${m.name} (${m.restaurant})` : m.name;
}

export const DEFAULT_WATER_TARGET_ML = 2000;

export function waterOn(logs: WaterLog[], dateKey: string): number {
  return logs.filter((l) => l.date === dateKey).reduce((s, l) => s + (l.ml || 0), 0);
}

/** Kalori per hari untuk n hari terakhir (untuk chart tren), urut lama → baru. */
export function dailyKcalSeries(
  entries: FoodEntry[],
  days: number,
  today: string = dateKeyWIB()
): { date: string; kcal: number }[] {
  const series: { date: string; kcal: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDateKey(today, -i);
    series.push({ date: day, kcal: consumedOn(entries, day).kcal });
  }
  return series;
}

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export const DEFAULT_GOALS: Goals = {
  kcalTarget: 2000,
  proteinTarget: 120,
  carbsTarget: 250,
  fatTarget: 65,
  waterTargetMl: 2000,
  activityLevel: "sedang",
};

export const MEAL_LABELS: Record<MealType, string> = {
  sarapan: "Sarapan",
  siang: "Makan siang",
  malam: "Makan malam",
  snack: "Snack",
};

export const MEAL_ORDER: MealType[] = ["sarapan", "siang", "malam", "snack"];

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta, tanpa DST

/** Kunci hari 'YYYY-MM-DD' dalam WIB — daily reset 00.00 WIB (brief §06). */
export function dateKeyWIB(input: string | Date = new Date()): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Geser dateKey n hari (n boleh negatif). */
export function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function entriesForDay(entries: FoodEntry[], dateKey: string): FoodEntry[] {
  return entries.filter((e) => dateKeyWIB(e.createdAt) === dateKey);
}

export function macroTotals(entries: FoodEntry[]): MacroTotals {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export function consumedOn(entries: FoodEntry[], dateKey: string): MacroTotals {
  return macroTotals(entriesForDay(entries, dateKey));
}

export function consumedToday(entries: FoodEntry[]): MacroTotals {
  return consumedOn(entries, dateKeyWIB());
}

export type Remaining = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** persen target kalori yang sudah terpakai, 0–>100 */
  pctUsed: number;
  over: boolean;
};

export function remaining(goals: Goals, consumed: MacroTotals): Remaining {
  const kcal = goals.kcalTarget - consumed.kcal;
  return {
    kcal,
    protein_g: goals.proteinTarget - consumed.protein_g,
    carbs_g: goals.carbsTarget - consumed.carbs_g,
    fat_g: goals.fatTarget - consumed.fat_g,
    pctUsed: goals.kcalTarget > 0 ? Math.round((consumed.kcal / goals.kcalTarget) * 100) : 0,
    over: kcal < 0,
  };
}

export type MealBreakdown = Record<MealType, MacroTotals>;

export function mealBreakdown(entries: FoodEntry[]): MealBreakdown {
  const base: MealBreakdown = {
    sarapan: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    siang: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    malam: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    snack: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  };
  for (const e of entries) {
    const m = base[e.meal] || base.snack;
    m.kcal += e.kcal || 0;
    m.protein_g += e.protein_g || 0;
    m.carbs_g += e.carbs_g || 0;
    m.fat_g += e.fat_g || 0;
  }
  return base;
}

/**
 * Streak = hari berurutan yang punya minimal 1 entry, dihitung mundur.
 * Hari ini belum log tidak memutus streak (baru putus kalau kemarin juga kosong).
 */
export function streak(entries: FoodEntry[], today: string = dateKeyWIB()): number {
  const days = new Set(entries.map((e) => dateKeyWIB(e.createdAt)));
  let count = 0;
  let cursor = days.has(today) ? today : shiftDateKey(today, -1);
  while (days.has(cursor)) {
    count++;
    cursor = shiftDateKey(cursor, -1);
  }
  return count;
}

/** Rata-rata kalori per hari yang tercatat dalam 7 hari terakhir (termasuk hari ini). */
export function weeklyAvg(entries: FoodEntry[], today: string = dateKeyWIB()): number {
  let total = 0;
  let daysLogged = 0;
  for (let i = 0; i < 7; i++) {
    const day = shiftDateKey(today, -i);
    const dayEntries = entriesForDay(entries, day);
    if (dayEntries.length > 0) {
      total += macroTotals(dayEntries).kcal;
      daysLogged++;
    }
  }
  return daysLogged > 0 ? Math.round(total / daysLogged) : 0;
}

export const fmtKcal = (n: number) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)} kkal`;

export const fmtNum = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
