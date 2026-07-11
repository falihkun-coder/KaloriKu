import {
  FoodEntry,
  Goals,
  WeightLog,
  MEAL_LABELS,
  MEAL_ORDER,
  consumedOn,
  dateKeyWIB,
  entriesForDay,
  fmtNum,
  mealBreakdown,
  remaining,
  shiftDateKey,
  streak,
} from "@/lib/calculations";

// Ringkasan harian format Telegram — dipakai webhook bot (/today) dan
// nanti cron daily-summary (S3). Satu sumber biar angka web = angka bot.
export function formatDailySummary(entries: FoodEntry[], goals: Goals, dateKey: string = dateKeyWIB()): string {
  const dayEntries = entriesForDay(entries, dateKey);
  const consumed = consumedOn(entries, dateKey);
  const r = remaining(goals, consumed);
  const breakdown = mealBreakdown(dayEntries);
  const streakDays = streak(entries, dateKey);

  const dateLabel = new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  });

  let msg = `🍽️ Ringkasan ${dateLabel}\n\n`;
  msg += `🔥 Kalori: ${fmtNum(consumed.kcal)} / ${fmtNum(goals.kcalTarget)} kkal (${r.pctUsed}%)\n`;
  msg += r.over
    ? `⚠️ Lewat target ${fmtNum(Math.abs(r.kcal))} kkal\n`
    : `✅ Sisa ${fmtNum(r.kcal)} kkal\n`;
  msg += `\n💪 Protein: ${fmtNum(consumed.protein_g)} / ${fmtNum(goals.proteinTarget)} g`;
  msg += `\n🍚 Karbo: ${fmtNum(consumed.carbs_g)} / ${fmtNum(goals.carbsTarget)} g`;
  msg += `\n🥑 Lemak: ${fmtNum(consumed.fat_g)} / ${fmtNum(goals.fatTarget)} g\n`;

  if (dayEntries.length > 0) {
    msg += `\n📋 Per waktu makan:`;
    for (const m of MEAL_ORDER) {
      if (breakdown[m].kcal > 0) {
        msg += `\n  • ${MEAL_LABELS[m]}: ${fmtNum(breakdown[m].kcal)} kkal`;
      }
    }
    msg += `\n`;
  } else {
    msg += `\nBelum ada makan tercatat hari ini.\n`;
  }

  if (streakDays > 0) msg += `\n🔥 Streak logging: ${streakDays} hari`;
  return msg;
}

// Ringkasan mingguan (7 hari terakhir, termasuk hari ini) — dikirim cron
// tiap Minggu 19.00 WIB (brief §09).
export function formatWeeklySummary(
  entries: FoodEntry[],
  goals: Goals,
  weights: WeightLog[] = [],
  today: string = dateKeyWIB()
): string {
  let totalKcal = 0;
  let daysLogged = 0;
  let daysOver = 0;
  for (let i = 6; i >= 0; i--) {
    const day = shiftDateKey(today, -i);
    const dayEntries = entriesForDay(entries, day);
    if (dayEntries.length === 0) continue;
    const kcal = consumedOn(entries, day).kcal;
    totalKcal += kcal;
    daysLogged++;
    if (kcal > goals.kcalTarget) daysOver++;
  }

  const avg = daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0;
  const budget = goals.kcalTarget * daysLogged;
  const balance = totalKcal - budget; // + = surplus, − = defisit
  const streakDays = streak(entries, today);

  let msg = `📊 Rekap 7 hari terakhir\n\n`;
  msg += `📅 Hari tercatat: ${daysLogged}/7\n`;
  if (daysLogged > 0) {
    msg += `🔥 Rata-rata: ${fmtNum(avg)} kkal/hari (target ${fmtNum(goals.kcalTarget)})\n`;
    msg += `✅ Sesuai target: ${daysLogged - daysOver} hari · ⚠️ Lewat: ${daysOver} hari\n`;
    msg +=
      balance <= 0
        ? `📉 Total defisit: ${fmtNum(Math.abs(balance))} kkal\n`
        : `📈 Total surplus: ${fmtNum(balance)} kkal\n`;
  } else {
    msg += `Belum ada makan tercatat minggu ini — gas mulai lagi besok! 💪\n`;
  }

  // Perubahan berat dalam ±7 hari kalau ada datanya
  const weekAgo = shiftDateKey(today, -7);
  const inRange = weights.filter((w) => w.date >= weekAgo && w.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inRange.length >= 2) {
    const diff = inRange[inRange.length - 1].kg - inRange[0].kg;
    const arrow = diff < 0 ? "↓" : diff > 0 ? "↑" : "→";
    msg += `⚖️ Berat: ${inRange[0].kg} → ${inRange[inRange.length - 1].kg} kg (${arrow} ${Math.abs(diff).toFixed(1)} kg)\n`;
  }

  if (streakDays > 0) msg += `\n🔥 Streak logging: ${streakDays} hari`;
  return msg;
}
