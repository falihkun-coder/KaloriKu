"use client";

import { Coffee, Sun, Moon, Cookie } from "lucide-react";
import { FoodEntry, MealType, MEAL_LABELS, MEAL_ORDER, mealBreakdown, fmtNum } from "@/lib/calculations";

const MEAL_META: Record<MealType, { icon: typeof Coffee; color: string }> = {
  sarapan: { icon: Coffee, color: "var(--meal-sarapan)" },
  siang: { icon: Sun, color: "var(--meal-siang)" },
  malam: { icon: Moon, color: "var(--meal-malam)" },
  snack: { icon: Cookie, color: "var(--meal-snack)" },
};

export function MealBreakdown({ todayEntries }: { todayEntries: FoodEntry[] }) {
  const breakdown = mealBreakdown(todayEntries);
  const total = MEAL_ORDER.reduce((s, m) => s + breakdown[m].kcal, 0);

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 h-full">
      <p className="font-heading font-bold tracking-tight text-[15px]">Per waktu makan</p>
      <p className="text-[12px] text-muted-foreground mt-0.5">Sebaran kalori hari ini</p>

      <div className="mt-4 space-y-4">
        {MEAL_ORDER.map((m) => {
          const { icon: Icon, color } = MEAL_META[m];
          const kcal = breakdown[m].kcal;
          const pct = total > 0 ? Math.round((kcal / total) * 100) : 0;
          return (
            <div key={m} className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-[11px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
              >
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold">{MEAL_LABELS[m]}</p>
                  <p className="text-[13px] font-bold tabular-nums">
                    {fmtNum(kcal)} <span className="text-[11px] font-semibold text-muted-foreground">kkal</span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-line-soft overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
