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
  /** Olahraga nambah budget kalori (net kalori). Default true. */
  exerciseAddsBudget?: boolean;
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

export type ExerciseType = "kardio" | "beban" | "hiit" | "jalan" | "lainnya";

/** Sesi olahraga — kkal terbakar nambah budget kalori (net kalori, brief §06). */
export type ExerciseEntry = {
  id: string;
  userId?: string;
  name: string;
  type: ExerciseType;
  durationMin: number;
  kcalBurned: number;
  avgHr?: number;
  maxHr?: number;
  source: EntrySource;
  createdAt: string; // ISO string
};

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  kardio: "Kardio",
  beban: "Angkat beban",
  hiit: "HIIT",
  jalan: "Jalan / lari",
  lainnya: "Lainnya",
};

export const EXERCISE_ORDER: ExerciseType[] = ["kardio", "beban", "hiit", "jalan", "lainnya"];

export function exercisesForDay(exercises: ExerciseEntry[], dateKey: string): ExerciseEntry[] {
  return exercises.filter((e) => dateKeyWIB(e.createdAt) === dateKey);
}

export function burnedOn(exercises: ExerciseEntry[], dateKey: string): number {
  return exercisesForDay(exercises, dateKey).reduce((s, e) => s + (e.kcalBurned || 0), 0);
}

export function burnedToday(exercises: ExerciseEntry[]): number {
  return burnedOn(exercises, dateKeyWIB());
}

export type MealCategory = "makanan" | "minuman" | "snack";

export const MEAL_CATEGORY_LABELS: Record<MealCategory, string> = {
  makanan: "Makanan",
  minuman: "Minuman",
  snack: "Snack",
};

export const MEAL_CATEGORY_ORDER: MealCategory[] = ["makanan", "minuman", "snack"];

/** Makanan favorit di library — 1-tap log tanpa AI (brief §7 ide 2, §11 mitigasi biaya). */
export type SavedMeal = {
  id: string;
  userId?: string;
  name: string;
  /** Nama resto/warung kalau ini menu resto (diisi AI lookup) */
  restaurant?: string;
  /** makanan | minuman | snack — buat filter library */
  category?: MealCategory;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  /** Breakdown per item kalau ini paket/combo */
  items?: MealItem[];
  useCount?: number;
};

// Tebak kategori dari nama — buat default + biar data lama tetap kefilter
// tanpa migrasi (dipanggil saat filter kalau category belum keisi).
export function guessMealCategory(name: string): MealCategory {
  const s = (name || "").toLowerCase();
  if (
    /(kopi|coffee|latte|americano|cappuccino|espresso|\bteh\b|thai tea|lemon tea|\bjus\b|juice|smoothie|milkshake|susu|\bmilk\b|matcha|boba|\bsoda\b|cola|coke|sprite|fanta|\bair\b|\bwater\b|mineral|infus|\bbir\b|beer|wine|\bes teh\b|\bes jeruk\b|minuman)/.test(s)
  )
    return "minuman";
  if (
    /(keripik|kerupuk|\bsnack\b|biskuit|biscuit|cookie|wafer|coklat|chocolate|permen|donat|donut|\bkue\b|\bcake\b|gorengan|es krim|ice cream|pudding|puding|roti bakar|pastry)/.test(s)
  )
    return "snack";
  return "makanan";
}

/** Kategori efektif: pakai yang tersimpan, atau tebak dari nama (data lama). */
export function mealCategoryOf(m: Pick<SavedMeal, "name" | "category">): MealCategory {
  return m.category ?? guessMealCategory(m.name);
}

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

// ===== Agregasi buat halaman Rekap (statistik gambar besar) =====

/** Satu titik harian: masuk (makanan), terbakar (olahraga), dan net-nya. */
export type DailyStat = {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  burned: number;
  /** makanan − olahraga */
  net: number;
  logged: boolean;
};

/** Deret harian gabungan makan + olahraga untuk n hari terakhir (lama → baru). */
export function dailyStats(
  entries: FoodEntry[],
  exercises: ExerciseEntry[],
  days: number,
  today: string = dateKeyWIB()
): DailyStat[] {
  const out: DailyStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDateKey(today, -i);
    const dayEntries = entriesForDay(entries, date);
    const t = macroTotals(dayEntries);
    const burned = burnedOn(exercises, date);
    out.push({
      date,
      kcal: t.kcal,
      protein_g: t.protein_g,
      carbs_g: t.carbs_g,
      fat_g: t.fat_g,
      burned,
      net: t.kcal - burned,
      logged: dayEntries.length > 0,
    });
  }
  return out;
}

export type AdherenceStats = {
  daysLogged: number;
  daysTotal: number;
  /** hari yang tercatat DAN kalorinya <= target */
  daysOnTarget: number;
  avgKcal: number;
  avgProtein: number;
  avgBurned: number;
  /** rata-rata net (masuk − terbakar) di hari yang tercatat */
  avgNet: number;
};

/** Ringkasan kepatuhan di rentang tertentu — cuma ngitung hari yang ada catatannya. */
export function adherenceStats(stats: DailyStat[], kcalTarget: number): AdherenceStats {
  const logged = stats.filter((s) => s.logged);
  const n = logged.length || 1;
  return {
    daysLogged: logged.length,
    daysTotal: stats.length,
    daysOnTarget: logged.filter((s) => s.kcal <= kcalTarget).length,
    avgKcal: Math.round(logged.reduce((s, d) => s + d.kcal, 0) / n),
    avgProtein: Math.round(logged.reduce((s, d) => s + d.protein_g, 0) / n),
    avgBurned: Math.round(stats.reduce((s, d) => s + d.burned, 0) / (stats.length || 1)),
    avgNet: Math.round(logged.reduce((s, d) => s + d.net, 0) / n),
  };
}

/** Rata-rata kalori per hari-dalam-seminggu — nunjukin pola (mis. weekend bocor). */
export function byDayOfWeek(stats: DailyStat[]): { day: DayKey; avgKcal: number; count: number }[] {
  const buckets = new Map<DayKey, number[]>();
  for (const s of stats) {
    if (!s.logged) continue;
    const d = todayDayKey(new Date(`${s.date}T12:00:00+07:00`));
    const list = buckets.get(d) || [];
    list.push(s.kcal);
    buckets.set(d, list);
  }
  return WEEKDAY_ORDER.map((day) => {
    const list = buckets.get(day) || [];
    return {
      day,
      avgKcal: list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0,
      count: list.length,
    };
  });
}

/** Total kalori per waktu makan di rentang tertentu. */
export function mealTimeSplit(entries: FoodEntry[], days: number, today: string = dateKeyWIB()) {
  const minKey = shiftDateKey(today, -(days - 1));
  const inRange = entries.filter((e) => {
    const k = dateKeyWIB(e.createdAt);
    return k >= minKey && k <= today;
  });
  const base = mealBreakdown(inRange);
  const total = MEAL_ORDER.reduce((s, m) => s + base[m].kcal, 0) || 1;
  return MEAL_ORDER.map((meal) => ({
    meal,
    label: MEAL_LABELS[meal],
    kcal: Math.round(base[meal].kcal),
    pct: Math.round((base[meal].kcal / total) * 100),
  }));
}

export type TopFood = { name: string; count: number; totalKcal: number; avgKcal: number };

/** Makanan yang paling sering dicatat — ngebongkar pola "makanan default". */
export function topFoods(entries: FoodEntry[], days: number, limit = 8, today: string = dateKeyWIB()): TopFood[] {
  const minKey = shiftDateKey(today, -(days - 1));
  const map = new Map<string, { name: string; count: number; totalKcal: number }>();
  for (const e of entries) {
    const k = dateKeyWIB(e.createdAt);
    if (k < minKey || k > today) continue;
    const key = (e.name || "").trim().toLowerCase();
    if (!key) continue;
    const cur = map.get(key) || { name: e.name.trim(), count: 0, totalKcal: 0 };
    cur.count++;
    cur.totalKcal += e.kcal || 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((f) => ({ ...f, totalKcal: Math.round(f.totalKcal), avgKcal: Math.round(f.totalKcal / f.count) }))
    .sort((a, b) => b.count - a.count || b.totalKcal - a.totalKcal)
    .slice(0, limit);
}

/** Kalori terbakar per jenis olahraga di rentang tertentu. */
export function exerciseSplit(exercises: ExerciseEntry[], days: number, today: string = dateKeyWIB()) {
  const minKey = shiftDateKey(today, -(days - 1));
  const map = new Map<ExerciseType, { kcal: number; min: number; sessions: number }>();
  for (const e of exercises) {
    const k = dateKeyWIB(e.createdAt);
    if (k < minKey || k > today) continue;
    const cur = map.get(e.type) || { kcal: 0, min: 0, sessions: 0 };
    cur.kcal += e.kcalBurned || 0;
    cur.min += e.durationMin || 0;
    cur.sessions++;
    map.set(e.type, cur);
  }
  return EXERCISE_ORDER.map((type) => {
    const v = map.get(type) || { kcal: 0, min: 0, sessions: 0 };
    return { type, label: EXERCISE_LABELS[type], kcal: Math.round(v.kcal), min: Math.round(v.min), sessions: v.sessions };
  }).filter((x) => x.sessions > 0);
}

export const DEFAULT_GOALS: Goals = {
  kcalTarget: 2000,
  proteinTarget: 120,
  carbsTarget: 250,
  fatTarget: 65,
  waterTargetMl: 2000,
  exerciseAddsBudget: true,
  activityLevel: "sedang",
};

export const MEAL_LABELS: Record<MealType, string> = {
  sarapan: "Sarapan",
  siang: "Makan siang",
  malam: "Makan malam",
  snack: "Snack",
};

export const MEAL_ORDER: MealType[] = ["sarapan", "siang", "malam", "snack"];

/** Tebak waktu makan dari jam sekarang (WIB) — buat default entri baru. */
export function currentMealWIB(now: Date = new Date()): MealType {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(now)
  );
  if (hour < 11) return "sarapan";
  if (hour < 15) return "siang";
  if (hour < 18) return "snack";
  if (hour < 22) return "malam";
  return "snack";
}

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

// ===== Jadwal olahraga mingguan (rencana latihan Falih) =====

export type DayKey = "sen" | "sel" | "rab" | "kam" | "jum" | "sab" | "min";
export const WEEKDAY_ORDER: DayKey[] = ["sen", "sel", "rab", "kam", "jum", "sab", "min"];
export const WEEKDAY_LABELS: Record<DayKey, string> = {
  sen: "Senin",
  sel: "Selasa",
  rab: "Rabu",
  kam: "Kamis",
  jum: "Jumat",
  sab: "Sabtu",
  min: "Minggu",
};
export const WEEKDAY_SHORT: Record<DayKey, string> = {
  sen: "Sen",
  sel: "Sel",
  rab: "Rab",
  kam: "Kam",
  jum: "Jum",
  sab: "Sab",
  min: "Min",
};

/** Hari ini (WIB) sebagai DayKey — buat highlight jadwal. */
export function todayDayKey(input: Date = new Date()): DayKey {
  const wib = new Date(input.getTime() + WIB_OFFSET_MS);
  const map: DayKey[] = ["min", "sen", "sel", "rab", "kam", "jum", "sab"]; // getUTCDay: 0=Min
  return map[wib.getUTCDay()];
}

// ===== Rencana makan mingguan =====

/** Satu slot makan yang udah direncanain (dari library atau hasil AI). */
export type PlannedMeal = {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  /** Kalau berasal dari meal library — biar bisa 1-tap log persis */
  mealId?: string;
  /** Kenapa menu ini dipilih (1 kalimat dari AI) */
  reason?: string;
};

export type DayPlan = Partial<Record<MealType, PlannedMeal>>;
export type MealPlan = {
  userId?: string;
  days: Record<DayKey, DayPlan>;
  updatedAt?: string;
  /** Makanan/bahan yang gak disukai — gak akan muncul lagi pas generate */
  dislikes?: string[];
};

export const EMPTY_MEAL_PLAN: MealPlan = {
  days: { sen: {}, sel: {}, rab: {}, kam: {}, jum: {}, sab: {}, min: {} },
};

/** Total makro satu hari di rencana. */
export function dayPlanTotals(day: DayPlan): MacroTotals {
  return MEAL_ORDER.reduce(
    (acc, m) => {
      const p = day[m];
      if (!p) return acc;
      return {
        kcal: acc.kcal + (p.kcal || 0),
        protein_g: acc.protein_g + (p.protein_g || 0),
        carbs_g: acc.carbs_g + (p.carbs_g || 0),
        fat_g: acc.fat_g + (p.fat_g || 0),
      };
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

/** Ada isinya nggak rencana ini (minimal 1 slot keisi). */
export function planHasContent(plan: MealPlan): boolean {
  return WEEKDAY_ORDER.some((d) => MEAL_ORDER.some((m) => plan.days[d]?.[m]));
}

export type WorkoutType = "full-body" | "cardio" | "badminton" | "jalan" | "rest" | "lainnya";
export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  "full-body": "Full Body",
  cardio: "Cardio",
  badminton: "Badminton",
  jalan: "Jalan / Tangga",
  rest: "Rest",
  lainnya: "Lainnya",
};
export const WORKOUT_EMOJI: Record<WorkoutType, string> = {
  "full-body": "💪",
  cardio: "🏃",
  badminton: "🏸",
  jalan: "🚶",
  rest: "😴",
  lainnya: "🤸",
};
export const WORKOUT_ORDER: WorkoutType[] = ["full-body", "cardio", "badminton", "jalan", "rest", "lainnya"];

export type ScheduleDay = { type: WorkoutType; note?: string };
export type WorkoutSchedule = { userId?: string; days: Record<DayKey, ScheduleDay> };

// Default: 3x Full Body/minggu (rencana) + hari tetap Falih (Sen cardio, Sel badminton, Rab rest).
export const DEFAULT_WORKOUT_SCHEDULE: WorkoutSchedule = {
  days: {
    sen: { type: "cardio" },
    sel: { type: "badminton" },
    rab: { type: "rest" },
    kam: { type: "full-body" },
    jum: { type: "full-body" },
    sab: { type: "full-body" },
    min: { type: "rest" },
  },
};

/** WorkoutType → ExerciseType buat prefill dialog catat olahraga. */
export const WORKOUT_TO_EXERCISE: Record<WorkoutType, ExerciseType> = {
  "full-body": "beban",
  cardio: "kardio",
  badminton: "kardio",
  jalan: "jalan",
  rest: "lainnya",
  lainnya: "lainnya",
};

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
  /** persen budget kalori (target + terbakar) yang sudah terpakai, 0–>100 */
  pctUsed: number;
  over: boolean;
  /** kkal terbakar yang dipakai memperluas budget (0 kalau toggle off) */
  burned: number;
  /** budget efektif = target + terbakar */
  effectiveTarget: number;
};

// burned = kkal olahraga yang nambah budget (caller yang decide sesuai
// goals.exerciseAddsBudget). Net kalori: sisa = target − masuk + terbakar.
export function remaining(goals: Goals, consumed: MacroTotals, burned = 0): Remaining {
  const effectiveTarget = goals.kcalTarget + burned;
  const kcal = effectiveTarget - consumed.kcal;
  return {
    kcal,
    protein_g: goals.proteinTarget - consumed.protein_g,
    carbs_g: goals.carbsTarget - consumed.carbs_g,
    fat_g: goals.fatTarget - consumed.fat_g,
    pctUsed: effectiveTarget > 0 ? Math.round((consumed.kcal / effectiveTarget) * 100) : 0,
    over: kcal < 0,
    burned,
    effectiveTarget,
  };
}

/** Helper: burned yang nambah budget sesuai preferensi user (0 kalau toggle off). */
export function budgetBurned(goals: Goals, exercises: ExerciseEntry[], dateKey: string = dateKeyWIB()): number {
  return goals.exerciseAddsBudget === false ? 0 : burnedOn(exercises, dateKey);
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
