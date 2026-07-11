"use client";

import { Beef, Wheat, Droplets } from "lucide-react";
import { Goals, MacroTotals, fmtNum } from "@/lib/calculations";

const MACROS = [
  { key: "protein_g", targetKey: "proteinTarget", label: "Protein", icon: Beef, color: "var(--protein)" },
  { key: "carbs_g", targetKey: "carbsTarget", label: "Karbo", icon: Wheat, color: "var(--carbs)" },
  { key: "fat_g", targetKey: "fatTarget", label: "Lemak", icon: Droplets, color: "var(--fat)" },
] as const;

export function MacroCards({ goals, consumed }: { goals: Goals; consumed: MacroTotals }) {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {MACROS.map((m) => {
        const value = consumed[m.key];
        const target = goals[m.targetKey] || 0;
        const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
        const Icon = m.icon;
        return (
          <div key={m.key} className="rounded-[18px] border border-border bg-card p-4">
            <div
              className="h-9 w-9 rounded-[11px] flex items-center justify-center mb-3"
              style={{ backgroundColor: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color }}
            >
              <Icon size={17} />
            </div>
            <p className="text-[12px] font-medium text-muted-foreground">{m.label}</p>
            <p className="font-heading font-bold tabular-nums tracking-tight text-lg mt-0.5">
              {fmtNum(value)}
              <span className="text-[12px] font-semibold text-muted-foreground"> / {fmtNum(target)} g</span>
            </p>
            <div className="mt-2.5 h-1.5 rounded-full bg-line-soft overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: m.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
