"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, Plus, ArrowRight } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MealType,
  PlannedMeal,
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

// "Menu hari ini" — jawaban instan buat "gua mau makan apa", 1 tap buat catat.
export function PlanCard() {
  const mealPlan = useStore((s) => s.mealPlan);
  const addEntry = useStore((s) => s.addEntry);
  const [busy, setBusy] = useState<string | null>(null);

  const today = todayDayKey();
  const dayPlan = mealPlan.days[today] || {};
  const filled = MEAL_ORDER.filter((m) => dayPlan[m]);
  const nowMeal = currentMealWIB();

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
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
            <CalendarCheck size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold tracking-tight text-[15px]">Menu hari ini</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Dari rencana mingguan kamu</p>
          </div>
        </div>
        <Link
          href="/rencana"
          className="text-[12px] font-semibold text-primary hover:underline shrink-0"
        >
          Atur
        </Link>
      </div>

      <div className="divide-y divide-line-soft">
        {filled.map((meal) => {
          const p = dayPlan[meal]!;
          const isNow = meal === nowMeal;
          return (
            <div key={meal} className="flex items-center gap-3 py-3">
              <span className={cn("text-[17px] shrink-0", !isNow && "opacity-60")}>{MEAL_EMOJI[meal]}</span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm truncate", isNow ? "font-bold" : "font-semibold text-muted-foreground")}>
                  {p.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {MEAL_LABELS[meal]} · {fmtNum(p.kcal)} kkal · P {fmtNum(p.protein_g)} g
                  {isNow && <span className="text-primary font-semibold"> · sekarang</span>}
                </p>
              </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
