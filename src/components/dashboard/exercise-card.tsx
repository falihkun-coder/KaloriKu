"use client";

import { Dumbbell, Plus } from "lucide-react";
import { ExerciseEntry, fmtNum } from "@/lib/calculations";
import { ExerciseRow, EXERCISE_COLOR } from "@/components/exercise/exercise-row";
import { useStore } from "@/store/useStore";

export function ExerciseCard({ todayExercises }: { todayExercises: ExerciseEntry[] }) {
  const openExerciseDialog = useStore((state) => state.openExerciseDialog);
  const totalBurned = todayExercises.reduce((s, e) => s + (e.kcalBurned || 0), 0);
  const totalMin = todayExercises.reduce((s, e) => s + (e.durationMin || 0), 0);

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-[11px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${EXERCISE_COLOR} 14%, transparent)`, color: EXERCISE_COLOR }}
          >
            <Dumbbell size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold tracking-tight text-[15px]">Olahraga hari ini</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {todayExercises.length > 0
                ? `${fmtNum(totalBurned)} kkal terbakar · ${fmtNum(totalMin)} menit`
                : "Belum ada sesi hari ini"}
            </p>
          </div>
        </div>
        <button
          onClick={() => openExerciseDialog()}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-[10px] text-[12px] font-bold shrink-0 transition-transform active:scale-[0.97]"
          style={{ backgroundColor: `color-mix(in srgb, ${EXERCISE_COLOR} 14%, transparent)`, color: EXERCISE_COLOR }}
        >
          <Plus size={14} /> Catat
        </button>
      </div>

      {todayExercises.length > 0 && (
        <div className="mt-2 divide-y divide-line-soft">
          {todayExercises.map((e) => (
            <ExerciseRow key={e.id} exercise={e} onClick={() => openExerciseDialog(e)} />
          ))}
        </div>
      )}
    </div>
  );
}
