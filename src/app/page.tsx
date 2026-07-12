"use client";

import { Flame, TrendingUp, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  consumedToday,
  entriesForDay,
  exercisesForDay,
  budgetBurned,
  dateKeyWIB,
  streak,
  weeklyAvg,
  fmtNum,
} from "@/lib/calculations";
import { HeroCard } from "@/components/dashboard/hero-card";
import { MacroCards } from "@/components/dashboard/macro-cards";
import { MacroDonut } from "@/components/dashboard/macro-donut";
import { MealBreakdown } from "@/components/dashboard/meal-breakdown";
import { TodayEntries } from "@/components/dashboard/today-entries";
import { WaterCard } from "@/components/dashboard/water-card";
import { ExerciseCard } from "@/components/dashboard/exercise-card";
import { AdvisorCard } from "@/components/dashboard/advisor-card";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const entries = useStore((state) => state.entries);
  const goals = useStore((state) => state.goals);
  const exercises = useStore((state) => state.exercises);
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const { user } = useAuth();

  const todayKey = dateKeyWIB();
  const todayEntries = entriesForDay(entries, todayKey);
  const todayExercises = exercisesForDay(exercises, todayKey);
  const consumed = consumedToday(entries);
  const burned = budgetBurned(goals, exercises, todayKey);
  const streakDays = streak(entries);
  const avg7 = weeklyAvg(entries);

  const email = user?.email || "";
  const name = user?.displayName || (email ? email.split("@")[0] : "");
  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div className="space-y-5 md:space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold tracking-tight text-[clamp(21px,3.4vw,27px)] leading-tight capitalize">
            Halo{name ? `, ${name}` : ""} 👋
          </h1>
          <p className="text-[13px] md:text-sm text-muted-foreground mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={() => openFoodDialog()}
          className="hidden md:flex items-center gap-2 px-4 h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] shrink-0"
        >
          <Plus size={17} />
          Catat makan
        </button>
      </div>

      {/* Hero + side stats */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2">
          <HeroCard goals={goals} consumed={consumed} burned={burned} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
          <div className="rounded-[18px] border border-border bg-card p-4 md:p-5">
            <div
              className="h-9 w-9 rounded-[11px] flex items-center justify-center mb-3"
              style={{ backgroundColor: "color-mix(in srgb, var(--streak) 14%, transparent)", color: "var(--streak)" }}
            >
              <Flame size={17} />
            </div>
            <p className="text-[12px] font-medium text-muted-foreground">Streak logging</p>
            <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
              {streakDays} <span className="text-[13px] font-semibold text-muted-foreground">hari</span>
            </p>
          </div>
          <div className="rounded-[18px] border border-border bg-card p-4 md:p-5">
            <div
              className="h-9 w-9 rounded-[11px] flex items-center justify-center mb-3"
              style={{ backgroundColor: "color-mix(in srgb, var(--positive) 14%, transparent)", color: "var(--positive)" }}
            >
              <TrendingUp size={17} />
            </div>
            <p className="text-[12px] font-medium text-muted-foreground">Rata-rata 7 hari</p>
            <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
              {fmtNum(avg7)} <span className="text-[13px] font-semibold text-muted-foreground">kkal</span>
            </p>
          </div>
        </div>
      </div>

      {/* Macro vs target */}
      <MacroCards goals={goals} consumed={consumed} />

      {/* Air minum */}
      <WaterCard />

      {/* Donut + per waktu makan */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
        <MacroDonut consumed={consumed} />
        <MealBreakdown todayEntries={todayEntries} />
      </div>

      {/* Olahraga hari ini */}
      <ExerciseCard todayExercises={todayExercises} />

      {/* Saran menu AI */}
      <AdvisorCard />

      {/* Entri hari ini */}
      <TodayEntries todayEntries={todayEntries} />
    </div>
  );
}
