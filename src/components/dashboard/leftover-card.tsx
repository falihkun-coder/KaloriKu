"use client";

import { useStore } from "@/store/useStore";
import { LeftoverList } from "@/components/food/leftover-list";

// Muncul cuma kalau ada sisa makanan — pengingat "ayam satunya belum dimakan".
export function LeftoverCard() {
  const meals = useStore((s) => s.meals);
  const leftovers = meals.filter((m) => m.leftover);
  if (leftovers.length === 0) return null;

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
      <p className="font-heading font-bold tracking-tight text-[15px]">🥡 Sisa makanan</p>
      <p className="text-[12px] text-muted-foreground mt-0.5">Tinggal tap Catat pas kamu makan sisanya.</p>
      <LeftoverList leftovers={leftovers} />
    </div>
  );
}
