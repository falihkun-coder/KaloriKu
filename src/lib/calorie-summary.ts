import {
  FoodEntry,
  Goals,
  MEAL_LABELS,
  MEAL_ORDER,
  consumedOn,
  dateKeyWIB,
  entriesForDay,
  fmtNum,
  mealBreakdown,
  remaining,
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
