"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, Plus, ArrowRight, Check } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MealType,
  PlannedMeal,
  SlotBudget,
  planHasContent,
  allocateDayPlan,
  entriesForDay,
  budgetBurned,
  dateKeyWIB,
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

/** Verdict singkat: menu contohnya muat gak di jatah ini */
function fitVerdict(b: SlotBudget): { text: string; color: string } {
  // toleransi 60 kkal — di bawah itu dianggap pas, gak usah rewel
  if (Math.abs(b.deltaKcal) <= 60) return { text: "pas ✓", color: "var(--primary)" };
  if (b.deltaKcal > 0) return { text: `lebih ${fmtNum(b.deltaKcal)} — kecilin porsi`, color: "var(--destructive)" };
  return { text: `muat, sisa ${fmtNum(Math.abs(b.deltaKcal))}`, color: "var(--positive)" };
}

// "Menu hari ini" — jawaban instan buat "gua mau makan apa", plus jatah kalori
// tiap waktu makan yang nyesuaiin sendiri tiap habis nyatet.
export function PlanCard() {
  const mealPlan = useStore((s) => s.mealPlan);
  const entries = useStore((s) => s.entries);
  const exercises = useStore((s) => s.exercises);
  const goals = useStore((s) => s.goals);
  const addEntry = useStore((s) => s.addEntry);
  const [busy, setBusy] = useState<string | null>(null);

  const today = todayDayKey();
  const dayPlan = mealPlan.days[today] || {};
  const filled = MEAL_ORDER.filter((m) => dayPlan[m]);
  const nowMeal = currentMealWIB();

  const todayKey = dateKeyWIB();
  const todayEntries = entriesForDay(entries, todayKey);
  const burned = budgetBurned(goals, exercises, todayKey);
  const alloc = allocateDayPlan(dayPlan, todayEntries, goals, burned);
  const budgetOf = (m: MealType) => alloc.slots.find((s) => s.meal === m);

  const logPlanned = async (meal: MealType, p: PlannedMeal) => {
    setBusy(meal);
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
      setBusy(null);
    }
  };

  // Belum ada rencana sama sekali → ajakin bikin
  if (!planHasContent(mealPlan) || filled.length === 0) {
    return (
      <Link
        href="/rencana"
        className="flex items-center gap-3 rounded-[22px] border border-dashed border-border bg-card p-5 hover:border-primary/40 transition-colors"
      >
        <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
          <CalendarCheck size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold tracking-tight text-[15px]">Bingung mau makan apa?</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Bikin rencana seminggu sekali — tiap hari tinggal tap catat.
          </p>
        </div>
        <ArrowRight size={16} className="text-muted-foreground shrink-0" />
      </Link>
    );
  }

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
            <CalendarCheck size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold tracking-tight text-[15px]">Menu hari ini</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {alloc.over ? (
                <span className="text-destructive font-semibold">
                  Udah lewat {fmtNum(Math.abs(alloc.remainingKcal))} kkal
                </span>
              ) : alloc.pendingCount > 0 ? (
                <>
                  Sisa <span className="font-bold text-foreground">{fmtNum(alloc.remainingKcal)} kkal</span> buat{" "}
                  {alloc.pendingCount} waktu makan
                  {alloc.remainingProtein > 0 && ` · protein ${fmtNum(alloc.remainingProtein)} g lagi`}
                </>
              ) : (
                "Semua menu hari ini udah dicatat 🎉"
              )}
            </p>
          </div>
        </div>
        <Link href="/rencana" className="text-[12px] font-semibold text-primary hover:underline shrink-0">
          Atur
        </Link>
      </div>

      <div className="divide-y divide-line-soft">
        {filled.map((meal) => {
          const p = dayPlan[meal]!;
          const b = budgetOf(meal);
          const done = b?.done ?? false;
          const isNow = meal === nowMeal && !done;

          return (
            <div key={meal} className="flex items-center gap-3 py-3">
              <span className={cn("text-[17px] shrink-0 self-start mt-1", (!isNow || done) && "opacity-60")}>
                {MEAL_EMOJI[meal]}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {MEAL_LABELS[meal]}
                  {isNow && <span className="text-primary"> · sekarang</span>}
                </p>

                {done ? (
                  /* Udah dicatat — angka jatah gak relevan lagi */
                  <>
                    <p className="font-heading font-bold tabular-nums tracking-tight text-[17px] text-muted-foreground leading-tight mt-0.5">
                      {fmtNum(p.kcal)}
                      <span className="text-[11px] font-semibold ml-1">kkal tercatat</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5 line-through decoration-muted-foreground/40">
                      {p.name}
                    </p>
                  </>
                ) : (
                  <>
                    {/* Jatah = angka utama, nyesuaiin sendiri tiap ada yang dicatat */}
                    <p
                      className={cn(
                        "font-heading font-bold tabular-nums tracking-tight leading-tight mt-0.5",
                        isNow ? "text-[22px]" : "text-[19px] text-muted-foreground"
                      )}
                    >
                      {fmtNum(b?.recommendedKcal ?? 0)}
                      <span className="text-[12px] font-semibold ml-1">kkal jatah</span>
                      {b && b.recommendedProtein > 0 && (
                        <span className="text-[11px] font-medium text-muted-foreground ml-2">
                          · P ~{fmtNum(b.recommendedProtein)} g
                        </span>
                      )}
                    </p>

                    {/* Menu rencana turun jadi contoh */}
                    <p className="text-[11px] text-muted-foreground truncate mt-1">
                      mis. {p.name} · {fmtNum(p.kcal)} kkal
                      {b && (
                        <span className="font-semibold" style={{ color: fitVerdict(b).color }}>
                          {" "}
                          — {fitVerdict(b).text}
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>

              {done ? (
                <span
                  className="flex items-center gap-1 px-2.5 h-8 rounded-[9px] text-[11px] font-bold shrink-0"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--positive) 14%, transparent)",
                    color: "var(--positive)",
                  }}
                >
                  <Check size={12} /> Udah
                </span>
              ) : (
                <button
                  onClick={() => logPlanned(meal, p)}
                  disabled={busy === meal}
                  className={cn(
                    "flex items-center gap-1 px-3 h-8 rounded-[9px] text-[11px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60 shrink-0",
                    isNow
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Plus size={12} /> Catat
                </button>
              )}
            </div>
          );
        })}
      </div>

      {alloc.pendingCount > 0 && !alloc.over && (
        <p className="text-[11px] text-muted-foreground mt-3">
          💡 Angka jatah dihitung ulang tiap kamu nyatet — menu di bawahnya cuma contoh yang muat di jatah itu.
        </p>
      )}
    </div>
  );
}
