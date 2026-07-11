"use client";

import { FoodEntry, MealType, MEAL_LABELS, fmtNum } from "@/lib/calculations";
import { Bot, ScanLine } from "lucide-react";

const MEAL_COLOR: Record<MealType, string> = {
  sarapan: "var(--meal-sarapan)",
  siang: "var(--meal-siang)",
  malam: "var(--meal-malam)",
  snack: "var(--meal-snack)",
};

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  const i = parts.map((p) => p[0]).join("").toUpperCase();
  return i || "?";
}

export function FoodRow({ entry, onClick }: { entry: FoodEntry; onClick?: () => void }) {
  const color = MEAL_COLOR[entry.meal] || "var(--meal-snack)";
  const time = new Date(entry.createdAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div onClick={onClick} className="group flex items-center gap-3 py-3 cursor-pointer">
      <div
        className="h-[42px] w-[42px] rounded-[12px] flex items-center justify-center text-[13px] font-bold shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        {initials(entry.name)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{entry.name}</p>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">
          {MEAL_LABELS[entry.meal]} · {entry.portion || "1 porsi"} · {time}
        </p>
      </div>

      {entry.source === "chat" && (
        <span className="text-muted-foreground shrink-0 hidden sm:inline" title="Dicatat via bot">
          <Bot size={14} />
        </span>
      )}
      {entry.source === "scan" && (
        <span className="text-muted-foreground shrink-0 hidden sm:inline" title="Dicatat via scan AI">
          <ScanLine size={14} />
        </span>
      )}

      <span className="text-sm font-bold tabular-nums shrink-0 text-foreground">
        {fmtNum(entry.kcal)} <span className="text-[11px] font-semibold text-muted-foreground">kkal</span>
      </span>
    </div>
  );
}
