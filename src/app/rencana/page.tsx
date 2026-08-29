"use client";

import { useState } from "react";
import { CalendarCheck, Sparkles, Loader2, Plus, RefreshCw, Trash2, ChevronDown, Utensils } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { auth } from "@/lib/firebase";
import {
  DayKey,
  MealType,
  PlannedMeal,
  MealPlan,
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  MEAL_ORDER,
  MEAL_LABELS,
  dayPlanTotals,
  planHasContent,
  todayDayKey,
  currentMealWIB,
  fmtNum,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MEAL_EMOJI: Record<MealType, string> = {
  sarapan: "🌅",
  siang: "☀️",
  malam: "🌙",
  snack: "🍪",
};

export default function RencanaPage() {
  const mealPlan = useStore((s) => s.mealPlan);
  const goals = useStore((s) => s.goals);
  const meals = useStore((s) => s.meals);
  const saveMealPlan = useStore((s) => s.saveMealPlan);
  const setPlanSlot = useStore((s) => s.setPlanSlot);
  const addEntry = useStore((s) => s.addEntry);
  const openFoodDialog = useStore((s) => s.openFoodDialog);

  const today = todayDayKey();
  const hasPlan = planHasContent(mealPlan);

  const [prefs, setPrefs] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<DayKey>(today);

  const generateWeek = async () => {
    if (hasPlan && !window.confirm("Ganti seluruh rencana minggu ini dengan yang baru?")) return;
    setGenerating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ preferences: prefs.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`plan failed: ${res.status}`);
      const { days } = (await res.json()) as { days: MealPlan["days"] };
      await saveMealPlan(days);
      setOpenDay(today);
      toast.success("Rencana seminggu jadi! 🗓️");
    } catch (e) {
      console.error(e);
      toast.error("Gagal bikin rencana — coba lagi");
    } finally {
      setGenerating(false);
    }
  };

  // Ganti 1 slot pakai AI (tetep hormatin menu lain di hari yang sama)
  const rerollSlot = async (day: DayKey, meal: MealType) => {
    const key = `${day}-${meal}`;
    setBusySlot(key);
    try {
      const dayPlan = mealPlan.days[day] || {};
      const others = MEAL_ORDER.filter((m) => m !== meal && dayPlan[m]).map((m) => ({
        meal: m,
        name: dayPlan[m]!.name,
        kcal: dayPlan[m]!.kcal,
      }));
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          mode: "slot",
          day,
          meal,
          avoid: dayPlan[meal]?.name,
          otherMealsToday: others,
          preferences: prefs.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`slot failed: ${res.status}`);
      const { planned } = (await res.json()) as { planned: PlannedMeal | null };
      if (!planned) throw new Error("empty slot");
      await setPlanSlot(day, meal, planned);
      toast.success(`Diganti: ${planned.name}`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal ganti menu");
    } finally {
      setBusySlot(null);
    }
  };

  // 1-tap: catat menu rencana jadi entri makan hari ini
  const logPlanned = async (meal: MealType, p: PlannedMeal) => {
    const key = `log-${meal}-${p.name}`;
    setBusySlot(key);
    try {
      await addEntry({
        name: p.name,
        kcal: p.kcal,
        protein_g: p.protein_g,
        carbs_g: p.carbs_g,
        fat_g: p.fat_g,
        portion: p.portion || "1 porsi",
        meal,
        source: "manual",
        createdAt: new Date().toISOString(),
      });
      toast.success(`${p.name} tercatat! 🍽️`);
    } catch {
      toast.error("Gagal catat");
    } finally {
      setBusySlot(null);
    }
  };

  const clearSlot = async (day: DayKey, meal: MealType) => {
    try {
      await setPlanSlot(day, meal, null);
    } catch {
      toast.error("Gagal hapus");
    }
  };

  // Isi slot manual dari meal library
  const fillFromLibrary = async (day: DayKey, meal: MealType, mealId: string) => {
    const m = meals.find((x) => x.id === mealId);
    if (!m) return;
    try {
      await setPlanSlot(day, meal, {
        name: m.restaurant ? `${m.name} (${m.restaurant})` : m.name,
        kcal: m.kcal,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
        portion: m.portion || "1 porsi",
        mealId: m.id,
      });
      toast.success("Rencana diupdate");
    } catch {
      toast.error("Gagal simpan");
    }
  };

  const todayPlan = mealPlan.days[today] || {};
  const todayTotals = dayPlanTotals(todayPlan);
  const nowMeal = currentMealWIB();
  const nextUp = todayPlan[nowMeal];

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Rencana Makan"
        description="Menu seminggu udah dipilihin — biar gak bingung tiap hari."
        icon={CalendarCheck}
      />

      {/* Fokus: menu berikutnya hari ini */}
      {hasPlan && (
        <div className="relative overflow-hidden rounded-[22px] bg-primary text-primary-foreground p-5 md:p-6">
          <div aria-hidden className="absolute -top-12 -right-8 w-44 h-44 rounded-full bg-white/10" />
          <div className="relative">
            <p className="text-[12px] font-semibold text-white/80 uppercase tracking-wide">
              {WEEKDAY_LABELS[today]} · {MEAL_LABELS[nowMeal]}
            </p>
            {nextUp ? (
              <>
                <p className="font-heading font-bold tracking-tight text-[clamp(19px,3.6vw,24px)] leading-tight mt-1">
                  {nextUp.name}
                </p>
                <p className="text-[13px] text-white/85 mt-1">
                  {fmtNum(nextUp.kcal)} kkal · P {fmtNum(nextUp.protein_g)} · K {fmtNum(nextUp.carbs_g)} · L{" "}
                  {fmtNum(nextUp.fat_g)} g · {nextUp.portion}
                </p>
                {nextUp.reason && <p className="text-[12px] text-white/70 mt-1.5">💡 {nextUp.reason}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => logPlanned(nowMeal, nextUp)}
                    disabled={busySlot === `log-${nowMeal}-${nextUp.name}`}
                    className="flex items-center gap-1.5 px-4 h-10 rounded-[11px] bg-white text-primary text-[13px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60"
                  >
                    <Plus size={15} /> Catat ini
                  </button>
                  <button
                    onClick={() => rerollSlot(today, nowMeal)}
                    disabled={busySlot === `${today}-${nowMeal}`}
                    className="flex items-center gap-1.5 px-3.5 h-10 rounded-[11px] bg-white/15 hover:bg-white/25 text-[13px] font-semibold transition-colors disabled:opacity-60"
                  >
                    {busySlot === `${today}-${nowMeal}` ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    Ganti
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/85 mt-1.5">Slot ini belum ada rencananya — scroll ke bawah buat isi.</p>
            )}
            <p className="text-[12px] text-white/70 mt-3">
              Total rencana hari ini: {fmtNum(todayTotals.kcal)} / {fmtNum(goals.kcalTarget)} kkal · protein{" "}
              {fmtNum(todayTotals.protein_g)} / {fmtNum(goals.proteinTarget)} g
            </p>
          </div>
        </div>
      )}

      {/* Generator */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
            <Sparkles size={17} />
          </div>
          <div>
            <p className="font-heading font-bold tracking-tight text-[15px]">
              {hasPlan ? "Bikin ulang rencana" : "Bikin rencana seminggu"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              AI susun 7 hari dari favorit kamu, pas sama {fmtNum(goals.kcalTarget)} kkal & {fmtNum(goals.proteinTarget)} g
              protein.
            </p>
          </div>
        </div>

        <textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={2}
          placeholder="Preferensi (opsional) — mis. sarapan simpel, gak suka seafood, budget hemat, sering makan di luar pas weekend"
          className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none"
        />

        <button
          onClick={generateWeek}
          disabled={generating}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? "AI lagi nyusun menu..." : hasPlan ? "Generate ulang seminggu" : "Generate rencana seminggu"}
        </button>

        {meals.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Tip: isi <span className="font-semibold text-foreground">Meal Library</span> dulu biar rencananya pakai
            makanan yang emang kamu suka.
          </p>
        )}
      </div>

      {/* Rencana per hari */}
      {!hasPlan ? (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <Utensils size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada rencana</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[320px]">
            Generate sekali, dipakai seminggu. Tiap hari tinggal liat & tap catat — gak perlu mikir lagi mau makan apa.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {WEEKDAY_ORDER.map((day) => {
            const dayPlan = mealPlan.days[day] || {};
            const totals = dayPlanTotals(dayPlan);
            const isToday = day === today;
            const isOpen = openDay === day;
            const overTarget = totals.kcal > goals.kcalTarget + 100;

            return (
              <div
                key={day}
                className={cn(
                  "rounded-[18px] border overflow-hidden transition-colors",
                  isToday ? "border-primary/40 bg-accent/25" : "border-border bg-card"
                )}
              >
                <button
                  onClick={() => setOpenDay(isOpen ? ("" as DayKey) : day)}
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-bold", isToday && "text-primary")}>
                      {WEEKDAY_LABELS[day]}
                      {isToday && <span className="text-[10px] font-semibold uppercase ml-2">Hari ini</span>}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                      {MEAL_ORDER.filter((m) => dayPlan[m])
                        .map((m) => dayPlan[m]!.name)
                        .join(" · ") || "Belum diisi"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-[13px] font-bold tabular-nums", overTarget && "text-destructive")}>
                      {fmtNum(totals.kcal)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">P {fmtNum(totals.protein_g)} g</p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn("text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2 border-t border-line-soft pt-3">
                    {MEAL_ORDER.map((meal) => {
                      const p = dayPlan[meal];
                      const slotKey = `${day}-${meal}`;
                      const logKey = `log-${meal}-${p?.name}`;
                      return (
                        <div key={meal} className="rounded-[12px] border border-border bg-background p-3">
                          <div className="flex items-start gap-2.5">
                            <span className="text-[16px] shrink-0 mt-0.5">{MEAL_EMOJI[meal]}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                {MEAL_LABELS[meal]}
                              </p>
                              {p ? (
                                <>
                                  <p className="text-[13px] font-bold truncate">{p.name}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {fmtNum(p.kcal)} kkal · P {fmtNum(p.protein_g)} · K {fmtNum(p.carbs_g)} · L{" "}
                                    {fmtNum(p.fat_g)} g · {p.portion}
                                  </p>
                                  {p.reason && <p className="text-[11px] text-muted-foreground/80 mt-1">💡 {p.reason}</p>}
                                </>
                              ) : (
                                <p className="text-[12px] text-muted-foreground italic mt-0.5">Kosong</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            {p && isToday && (
                              <button
                                onClick={() => logPlanned(meal, p)}
                                disabled={busySlot === logKey}
                                className="flex items-center gap-1 px-3 h-8 rounded-[9px] bg-primary text-primary-foreground text-[11px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60"
                              >
                                <Plus size={12} /> Catat
                              </button>
                            )}
                            <button
                              onClick={() => rerollSlot(day, meal)}
                              disabled={busySlot === slotKey}
                              className="flex items-center gap-1 px-3 h-8 rounded-[9px] border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
                            >
                              {busySlot === slotKey ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              {p ? "Ganti" : "Isiin AI"}
                            </button>

                            {meals.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => e.target.value && fillFromLibrary(day, meal, e.target.value)}
                                className="h-8 rounded-[9px] border border-border bg-card text-[11px] font-semibold text-muted-foreground px-2 outline-none focus:border-primary transition-colors max-w-[150px]"
                              >
                                <option value="">Dari favorit…</option>
                                {meals.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.restaurant ? `${m.name} (${m.restaurant})` : m.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {p && (
                              <>
                                {isToday && (
                                  <button
                                    onClick={() =>
                                      openFoodDialog({
                                        name: p.name,
                                        kcal: p.kcal,
                                        protein_g: p.protein_g,
                                        carbs_g: p.carbs_g,
                                        fat_g: p.fat_g,
                                        portion: p.portion,
                                        meal,
                                        source: "manual",
                                      })
                                    }
                                    className="px-3 h-8 rounded-[9px] border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    Edit & catat
                                  </button>
                                )}
                                <button
                                  onClick={() => clearSlot(day, meal)}
                                  aria-label={`Hapus ${MEAL_LABELS[meal]} ${WEEKDAY_LABELS[day]}`}
                                  className="h-8 w-8 rounded-[9px] border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors ml-auto"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-muted-foreground px-1">
        Rencana ini pola mingguan — kepake terus tiap minggu sampai kamu generate ulang. Angka gizinya estimasi, bisa
        dikoreksi pas nyatet.
      </p>
    </div>
  );
}
