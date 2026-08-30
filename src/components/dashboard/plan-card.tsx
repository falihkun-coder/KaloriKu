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

/** Label kecil: rencana vs jatah optimal buat slot ini */
function DeltaHint({ b }: { b: SlotBudget }) {
  // toleransi 60 kkal — di bawah itu dianggap pas, gak usah rewel
  if (Math.abs(b.deltaKcal) <= 60) {
    return <span className="text-primary font-semibold">pas sama jatah</span>;
  }
  if (b.deltaKcal > 0) {
    return (
      <span className="text-destructive font-semibold">
        lebih {fmtNum(b.deltaKcal)} kkal — kurangi porsi
      </span>
    );
  }
  return (
    <span style={{ color: "var(--positive)" }} className="font-semibold">
      masih ada ruang {fmtNum(Math.abs(b.deltaKcal))} kkal
    </span>
  );
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
              <span className={cn("text-[17px] shrink-0", (!isNow || done) && "opacity-60")}>{MEAL_EMOJI[meal]}</span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm truncate",
                    done
                      ? "font-semibold text-muted-foreground line-through decoration-muted-foreground/40"
                      : isNow
                        ? "font-bold"
                        : "font-semibold text-muted-foreground"
                  )}
                >
                  {p.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {MEAL_LABELS[meal]} · {fmtNum(p.kcal)} kkal · P {fmtNum(p.protein_g)} g
                  {isNow && <span className="text-primary font-semibold"> · sekarang</span>}
                </p>

                {/* Jatah optimal — nyesuaiin sendiri tiap ada yang dicatat */}
                {!done && b && (
                  <p className="text-[11px] truncate mt-0.5">
                    <span className="text-muted-foreground">Jatah {fmtNum(b.recommendedKcal)} kkal · </span>
                    <DeltaHint b={b} />
                  </p>
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
          💡 Jatah dibagi otomatis dari sisa kalori — tiap kamu nyatet, sisanya dihitung ulang.
        </p>
      )}
    </div>
  );
}
