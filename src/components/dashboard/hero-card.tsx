"use client";

import { Flame } from "lucide-react";
import { Goals, MacroTotals, remaining, fmtNum } from "@/lib/calculations";

export function HeroCard({ goals, consumed }: { goals: Goals; consumed: MacroTotals }) {
  const r = remaining(goals, consumed);
  const pct = Math.min(100, Math.max(0, r.pctUsed));

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-primary text-primary-foreground p-6 md:p-7 shadow-[0_18px_44px_var(--accent-shadow)]">
      <div aria-hidden className="absolute -top-14 -right-10 w-52 h-52 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-white/[0.07]" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-white/80">Sisa kalori hari ini</p>
          {r.over ? (
            <span className="text-[11px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
              Lewat target
            </span>
          ) : (
            <span className="text-[11px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
              {pct}% terpakai
            </span>
          )}
        </div>

        <p className="font-heading font-bold tabular-nums tracking-tight text-[clamp(40px,7vw,56px)] leading-none mt-3">
          {fmtNum(Math.abs(r.kcal))}
          <span className="text-[17px] font-semibold text-white/75 ml-2">
            {r.over ? "kkal lebih" : "kkal lagi"}
          </span>
        </p>

        <p className="text-[13px] text-white/75 mt-2">
          {fmtNum(consumed.kcal)} dari target {fmtNum(goals.kcalTarget)} kkal
        </p>

        <div className="mt-4 h-2.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 flex items-center gap-2 text-[12px] text-white/75">
          <Flame size={14} />
          <span>
            {r.over
              ? "Santai — besok reset lagi jam 00.00 WIB."
              : "Masih aman, atur sisa buat makan berikutnya."}
          </span>
        </div>
      </div>
    </div>
  );
}
