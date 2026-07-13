"use client";

import Link from "next/link";
import { Flame, ScanLine, Calculator, TrendingUp } from "lucide-react";
import { Goals, MacroTotals, remaining, fmtNum } from "@/lib/calculations";

export function HeroCard({ goals, consumed, burned = 0 }: { goals: Goals; consumed: MacroTotals; burned?: number }) {
  const r = remaining(goals, consumed, burned);
  const pct = Math.min(100, Math.max(0, r.pctUsed));

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-primary text-primary-foreground p-6 md:p-7 shadow-[0_18px_44px_var(--accent-shadow)]">
      <div aria-hidden className="absolute -top-14 -right-10 w-52 h-52 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-white/[0.07]" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-white/80">Kalori hari ini</p>
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

        <div className="flex flex-wrap items-start gap-x-9 gap-y-3 mt-3">
          {/* Sisa kalori (budget, sudah termasuk olahraga) */}
          <div>
            <p className="text-[12px] font-medium text-white/70">Sisa kalori</p>
            <p className="font-heading font-bold tabular-nums tracking-tight text-[clamp(38px,6.5vw,54px)] leading-none mt-0.5">
              {fmtNum(Math.abs(r.kcal))}
              <span className="text-[16px] font-semibold text-white/75 ml-2">
                {r.over ? "kkal lebih" : "kkal lagi"}
              </span>
            </p>
          </div>

          {/* Net kalori masuk = makanan − olahraga */}
          {burned > 0 && (
            <div className="pl-0 sm:pl-9 sm:border-l sm:border-white/20">
              <p className="text-[12px] font-medium text-white/70">Net masuk (− olahraga)</p>
              <p className="font-heading font-bold tabular-nums tracking-tight text-[clamp(38px,6.5vw,54px)] leading-none mt-0.5">
                {fmtNum(consumed.kcal - burned)}
                <span className="text-[16px] font-semibold text-white/75 ml-2">kkal</span>
              </p>
            </div>
          )}
        </div>

        <p className="text-[13px] text-white/75 mt-3">
          {fmtNum(consumed.kcal)} dari target {fmtNum(goals.kcalTarget)} kkal
          {burned > 0 && <span className="text-white/90 font-semibold"> +{fmtNum(burned)} dari olahraga 🔥</span>}
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

        <div className="mt-4 flex gap-2">
          <Link
            href="/scan"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-[12px] font-semibold transition-colors"
          >
            <ScanLine size={13} /> Scan AI
          </Link>
          <Link
            href="/simulator"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-[12px] font-semibold transition-colors"
          >
            <Calculator size={13} /> Muat gak?
          </Link>
          <Link
            href="/tren"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-[12px] font-semibold transition-colors"
          >
            <TrendingUp size={13} /> Tren
          </Link>
        </div>
      </div>
    </div>
  );
}
