"use client";

import { Dumbbell, Plus, Heart } from "lucide-react";
import { ExerciseEntry, EXERCISE_LABELS, fmtNum } from "@/lib/calculations";
import { useStore } from "@/store/useStore";

const EXERCISE_COLOR = "#5B7FC4";

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "?";
}

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
            <div
              key={e.id}
              onClick={() => openExerciseDialog(e)}
              className="group flex items-center gap-3 py-3 cursor-pointer"
            >
              <div
                className="h-[42px] w-[42px] rounded-[12px] flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${EXERCISE_COLOR} 14%, transparent)`, color: EXERCISE_COLOR }}
              >
                {initials(e.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {e.name}
                </p>
                <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                  {EXERCISE_LABELS[e.type]}
                  {e.durationMin ? ` · ${fmtNum(e.durationMin)} mnt` : ""}
                  {e.avgHr ? (
                    <>
                      {" · "}
                      <Heart size={10} className="inline -mt-0.5" /> {fmtNum(e.avgHr)}
                      {e.maxHr ? `/${fmtNum(e.maxHr)}` : ""} bpm
                    </>
                  ) : (
                    ""
                  )}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: EXERCISE_COLOR }}>
                −{fmtNum(e.kcalBurned)} <span className="text-[11px] font-semibold text-muted-foreground">kkal</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
