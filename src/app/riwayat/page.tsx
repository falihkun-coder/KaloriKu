"use client";

import { useMemo, useState } from "react";
import { History, Plus, UtensilsCrossed, Dumbbell, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FoodRow } from "@/components/food/food-row";
import { ExerciseRow } from "@/components/exercise/exercise-row";
import { useStore } from "@/store/useStore";
import {
  FoodEntry,
  ExerciseEntry,
  MealType,
  ExerciseType,
  MEAL_LABELS,
  MEAL_ORDER,
  EXERCISE_LABELS,
  EXERCISE_ORDER,
  dateKeyWIB,
  shiftDateKey,
  macroTotals,
  fmtNum,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "all";
type View = "makan" | "olahraga";
type MealFilter = "semua" | MealType;
type TypeFilter = "semua" | ExerciseType;

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

function minKeyFor(period: Period): string | null {
  const today = dateKeyWIB();
  if (period === "7d") return shiftDateKey(today, -6);
  if (period === "30d") return shiftDateKey(today, -29);
  return null;
}

function groupByDay<T extends { createdAt: string }>(items: T[]): [string, T[]][] {
  const byDay = new Map<string, T[]>();
  for (const it of items) {
    const key = dateKeyWIB(it.createdAt);
    const list = byDay.get(key) || [];
    list.push(it);
    byDay.set(key, list);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1));
}

export default function RiwayatPage() {
  const entries = useStore((state) => state.entries);
  const exercises = useStore((state) => state.exercises);
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const openExerciseDialog = useStore((state) => state.openExerciseDialog);

  const [view, setView] = useState<View>("makan");
  const [period, setPeriod] = useState<Period>("7d");
  const [mealFilter, setMealFilter] = useState<MealFilter>("semua");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("semua");

  const groupedFood = useMemo(() => {
    const minKey = minKeyFor(period);
    const filtered = entries.filter((e) => {
      const key = dateKeyWIB(e.createdAt);
      if (minKey && key < minKey) return false;
      if (mealFilter !== "semua" && e.meal !== mealFilter) return false;
      return true;
    });
    return groupByDay<FoodEntry>(filtered);
  }, [entries, period, mealFilter]);

  const groupedEx = useMemo(() => {
    const minKey = minKeyFor(period);
    const filtered = exercises.filter((e) => {
      const key = dateKeyWIB(e.createdAt);
      if (minKey && key < minKey) return false;
      if (typeFilter !== "semua" && e.type !== typeFilter) return false;
      return true;
    });
    return groupByDay<ExerciseEntry>(filtered);
  }, [exercises, period, typeFilter]);

  const isFood = view === "makan";
  const isEmpty = isFood ? groupedFood.length === 0 : groupedEx.length === 0;

  // Export CSV sesuai view + filter aktif
  const handleExport = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    let header: string[];
    let lines: string[];
    if (isFood) {
      const rows = groupedFood.flatMap(([, d]) => d);
      if (rows.length === 0) return;
      header = ["tanggal", "jam", "nama", "porsi", "waktu_makan", "kcal", "protein_g", "karbo_g", "lemak_g", "sumber"];
      lines = rows.map((e) => {
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
    } else {
      const rows = groupedEx.flatMap(([, d]) => d);
      if (rows.length === 0) return;
      header = ["tanggal", "jam", "nama", "jenis", "durasi_menit", "kkal_terbakar", "avg_hr", "max_hr", "sumber"];
      lines = rows.map((e) => {
        const d = new Date(e.createdAt);
        return [
          dateKeyWIB(e.createdAt),
          d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
          esc(e.name),
          EXERCISE_LABELS[e.type] || e.type,
          e.durationMin || 0,
          e.kcalBurned || 0,
          e.avgHr ?? "",
          e.maxHr ?? "",
          e.source,
        ].join(",");
      });
    }
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaloriku-${isFood ? "makan" : "olahraga"}-${dateKeyWIB()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAdd = () => (isFood ? openFoodDialog() : openExerciseDialog());

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Riwayat"
        description="Semua catatan makan & olahraga, dikelompokkan per hari."
        icon={History}
        action={
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isEmpty}
              className="flex items-center gap-2 px-4 h-11 rounded-[12px] border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
            >
              <Plus size={17} />
              {isFood ? "Catat makan" : "Catat olahraga"}
            </button>
          </div>
        }
      />

      {/* View toggle: Makan / Olahraga */}
      <div className="flex p-1 bg-muted rounded-[12px] w-fit">
        {(
          [
            ["makan", "🍽️ Makan"],
            ["olahraga", "💪 Olahraga"],
          ] as [View, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-4 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors",
              view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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

        {isFood ? (
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
        ) : (
          <div className="flex flex-wrap gap-2">
            {(["semua", ...EXERCISE_ORDER] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  typeFilter === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {t === "semua" ? "Semua" : EXERCISE_LABELS[t as ExerciseType]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grouped list */}
      {isEmpty ? (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            {isFood ? <UtensilsCrossed size={20} /> : <Dumbbell size={20} />}
          </div>
          <p className="text-sm font-semibold">Belum ada riwayat di filter ini</p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-4 max-w-[280px]">
            Coba ganti filter, atau langsung catat {isFood ? "makan" : "olahraga"} sekarang.
          </p>
          <button
            onClick={openAdd}
            className="px-4 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
          >
            + Catat {isFood ? "makan" : "olahraga"}
          </button>
        </div>
      ) : isFood ? (
        <div className="space-y-4">
          {groupedFood.map(([dateKey, dayEntries]) => {
            const totals = macroTotals(dayEntries);
            return (
              <div key={dateKey} className="rounded-[22px] border border-border bg-card p-5 md:p-6">
                <div className="flex items-center justify-between gap-3 pb-1">
                  <p className="font-heading font-bold tracking-tight text-[15px]">{dayLabel(dateKey)}</p>
                  <p className="text-[13px] font-bold tabular-nums">
                    {fmtNum(totals.kcal)} <span className="text-[11px] font-semibold text-muted-foreground">kkal</span>
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
      ) : (
        <div className="space-y-4">
          {groupedEx.map(([dateKey, dayEx]) => {
            const totalBurned = dayEx.reduce((s, e) => s + (e.kcalBurned || 0), 0);
            const totalMin = dayEx.reduce((s, e) => s + (e.durationMin || 0), 0);
            return (
              <div key={dateKey} className="rounded-[22px] border border-border bg-card p-5 md:p-6">
                <div className="flex items-center justify-between gap-3 pb-1">
                  <p className="font-heading font-bold tracking-tight text-[15px]">{dayLabel(dateKey)}</p>
                  <p className="text-[13px] font-bold tabular-nums">
                    {fmtNum(totalBurned)} <span className="text-[11px] font-semibold text-muted-foreground">kkal · {fmtNum(totalMin)} mnt</span>
                  </p>
                </div>
                <div className="divide-y divide-line-soft">
                  {dayEx.map((e) => (
                    <ExerciseRow key={e.id} exercise={e} onClick={() => openExerciseDialog(e)} />
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
