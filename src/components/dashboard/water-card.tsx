"use client";

import { useState } from "react";
import { GlassWater } from "lucide-react";
import { useStore } from "@/store/useStore";
import { DEFAULT_WATER_TARGET_ML, dateKeyWIB, fmtNum, waterOn } from "@/lib/calculations";
import { toast } from "sonner";

const WATER_COLOR = "#4A90C2";

export function WaterCard() {
  const waterLogs = useStore((state) => state.waterLogs);
  const goals = useStore((state) => state.goals);
  const addWater = useStore((state) => state.addWater);
  const [busy, setBusy] = useState(false);

  const today = waterOn(waterLogs, dateKeyWIB());
  const target = goals.waterTargetMl || DEFAULT_WATER_TARGET_ML;
  const pct = Math.min(100, Math.round((today / target) * 100));

  const quickAdd = async (ml: number) => {
    setBusy(true);
    try {
      await addWater(ml);
    } catch {
      toast.error("Gagal catat air");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[18px] border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-[11px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${WATER_COLOR} 14%, transparent)`, color: WATER_COLOR }}
          >
            <GlassWater size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-muted-foreground">Air minum</p>
            <p className="font-heading font-bold tabular-nums tracking-tight text-lg leading-tight">
              {fmtNum(today)}
              <span className="text-[12px] font-semibold text-muted-foreground"> / {fmtNum(target)} ml</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {[250, 500].map((ml) => (
            <button
              key={ml}
              onClick={() => quickAdd(ml)}
              disabled={busy}
              className="px-3 h-9 rounded-full text-[12px] font-bold border transition-colors disabled:opacity-50"
              style={{
                borderColor: `color-mix(in srgb, ${WATER_COLOR} 35%, transparent)`,
                color: WATER_COLOR,
                backgroundColor: `color-mix(in srgb, ${WATER_COLOR} 8%, transparent)`,
              }}
            >
              +{ml}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-line-soft overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: WATER_COLOR }}
        />
      </div>
    </div>
  );
}
