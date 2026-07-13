"use client";

import { Heart } from "lucide-react";
import { ExerciseEntry, EXERCISE_LABELS, fmtNum } from "@/lib/calculations";

export const EXERCISE_COLOR = "#5B7FC4";

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "?";
}

export function ExerciseRow({ exercise, onClick }: { exercise: ExerciseEntry; onClick?: () => void }) {
  const time = new Date(exercise.createdAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div onClick={onClick} className="group flex items-center gap-3 py-3 cursor-pointer">
      <div
        className="h-[42px] w-[42px] rounded-[12px] flex items-center justify-center text-[13px] font-bold shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${EXERCISE_COLOR} 14%, transparent)`, color: EXERCISE_COLOR }}
      >
        {initials(exercise.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
          {exercise.name}
        </p>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">
          {EXERCISE_LABELS[exercise.type]}
          {exercise.durationMin ? ` · ${fmtNum(exercise.durationMin)} mnt` : ""}
          {exercise.avgHr ? (
            <>
              {" · "}
              <Heart size={10} className="inline -mt-0.5" /> {fmtNum(exercise.avgHr)}
              {exercise.maxHr ? `/${fmtNum(exercise.maxHr)}` : ""} bpm
            </>
          ) : (
            ` · ${time}`
          )}
        </p>
      </div>
      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: EXERCISE_COLOR }}>
        −{fmtNum(exercise.kcalBurned)} <span className="text-[11px] font-semibold text-muted-foreground">kkal</span>
      </span>
    </div>
  );
}
