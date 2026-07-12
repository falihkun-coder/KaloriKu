"use client";

import { useMemo, useState } from "react";
import { History, Plus, UtensilsCrossed, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FoodRow } from "@/components/food/food-row";
import { useStore } from "@/store/useStore";
import {
  FoodEntry,
  MealType,
  MEAL_LABELS,
  MEAL_ORDER,
  dateKeyWIB,
  shiftDateKey,
  macroTotals,
  fmtNum,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "all";
type MealFilter = "semua" | MealType;

const PERIODS: { id: Period; label: string }[] = [
  { id: "7d", label: "7 hari" },
  { id: "30d", label: "30 hari" },
  { id: "all", label: "Semua" },
];

function dayLabel(dateKey: string): string {
  const today = dateKeyWIB();
  if (dateKey === today) return "Hari ini";
  if (dateKey === shiftDateKey(today, -1)) return "Kemarin";
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  });
}

export default function RiwayatPage() {
  const entries = useStore((state) => state.entries);
  const openFoodDialog = useStore((state) => state.openFoodDialog);

  const [period, setPeriod] = useState<Period>("7d");
  const [mealFilter, setMealFilter] = useState<MealFilter>("semua");

  const grouped = useMemo(() => {
    const today = dateKeyWIB();
    const minKey =
      period === "7d" ? shiftDateKey(today, -6) : period === "30d" ? shiftDateKey(today, -29) : null;

    const filtered = entries.filter((e) => {
      const key = dateKeyWIB(e.createdAt);
      if (minKey && key < minKey) return false;
      if (mealFilter !== "semua" && e.meal !== mealFilter) return false;
      return true;
    });

    const byDay = new Map<string, FoodEntry[]>();
    for (const e of filtered) {
      const key = dateKeyWIB(e.createdAt);
      const list = byDay.get(key) || [];
      list.push(e);
      byDay.set(key, list);
    }
    // entries sudah urut terbaru dulu dari store, tinggal urutkan harinya
    return [...byDay.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1));
  }, [entries, period, mealFilter]);

  // Export CSV sesuai filter aktif — buat rekap pribadi / konsul ahli gizi
  const handleExport = () => {
    const rows = grouped.flatMap(([, dayEntries]) => dayEntries);
    if (rows.length === 0) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["tanggal", "jam", "nama", "porsi", "waktu_makan", "kcal", "protein_g", "karbo_g", "lemak_g", "sumber"];
    const lines = rows.map((e) => {
      const d = new Date(e.createdAt);
      return [
        dateKeyWIB(e.createdAt),
        d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
        esc(e.name),
        esc(e.portion || ""),
        MEAL_LABELS[e.meal] || e.meal,
        e.kcal,
        e.protein_g,
        e.carbs_g,
        e.fat_g,
        e.source,
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaloriku-riwayat-${dateKeyWIB()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Riwayat Makan"
        description="Semua yang kamu catat, dikelompokkan per hari."
        icon={History}
        action={
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={grouped.length === 0}
              className="flex items-center gap-2 px-4 h-11 rounded-[12px] border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={() => openFoodDialog()}
              className="flex items-center gap-2 px-4 h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
            >
              <Plus size={17} />
              Catat makan
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Segmented period */}
        <div className="flex p-1 bg-muted rounded-[12px]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors",
                period === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Meal pills */}
        <div className="flex flex-wrap gap-2">
          {(["semua", ...MEAL_ORDER] as MealFilter[]).map((m) => (
            <button
              key={m}
              onClick={() => setMealFilter(m)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                mealFilter === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {m === "semua" ? "Semua" : MEAL_LABELS[m as MealType]}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <UtensilsCrossed size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada riwayat di filter ini</p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-4 max-w-[280px]">
            Coba ganti filter, atau langsung catat makan sekarang.
          </p>
          <button
            onClick={() => openFoodDialog()}
            className="px-4 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
          >
            + Catat makan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, dayEntries]) => {
            const totals = macroTotals(dayEntries);
            return (
              <div key={dateKey} className="rounded-[22px] border border-border bg-card p-5 md:p-6">
                <div className="flex items-center justify-between gap-3 pb-1">
                  <p className="font-heading font-bold tracking-tight text-[15px]">{dayLabel(dateKey)}</p>
                  <p className="text-[13px] font-bold tabular-nums">
                    {fmtNum(totals.kcal)}{" "}
                    <span className="text-[11px] font-semibold text-muted-foreground">kkal</span>
                  </p>
                </div>
                <div className="divide-y divide-line-soft">
                  {dayEntries.map((e) => (
                    <FoodRow key={e.id} entry={e} onClick={() => openFoodDialog(e)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
