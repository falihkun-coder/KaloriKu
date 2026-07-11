"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { MacroTotals, fmtNum } from "@/lib/calculations";
import { PieChart as PieIcon } from "lucide-react";
import { useStore } from "@/store/useStore";

// kkal per gram: protein 4, karbo 4, lemak 9
export function MacroDonut({ consumed }: { consumed: MacroTotals }) {
  const openFoodDialog = useStore((state) => state.openFoodDialog);

  const data = [
    { name: "Protein", value: consumed.protein_g * 4, grams: consumed.protein_g, color: "var(--protein)" },
    { name: "Karbo", value: consumed.carbs_g * 4, grams: consumed.carbs_g, color: "var(--carbs)" },
    { name: "Lemak", value: consumed.fat_g * 9, grams: consumed.fat_g, color: "var(--fat)" },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 h-full flex flex-col">
      <p className="font-heading font-bold tracking-tight text-[15px]">Komposisi makro</p>
      <p className="text-[12px] text-muted-foreground mt-0.5">Kalori dari protein, karbo & lemak hari ini</p>

      {total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <PieIcon size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada data</p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-3">Catat makan pertamamu hari ini.</p>
          <button
            onClick={() => openFoodDialog()}
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            + Catat makan
          </button>
        </div>
      ) : (
        <>
          <div className="relative h-[180px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="95%"
                  paddingAngle={3}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="font-heading font-bold tabular-nums tracking-tight text-xl leading-none">
                {fmtNum(consumed.kcal)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">kkal masuk</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground flex-1">{d.name}</span>
                <span className="font-semibold tabular-nums">{fmtNum(d.grams)} g</span>
                <span className="text-muted-foreground tabular-nums w-11 text-right">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
