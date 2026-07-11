"use client";

import Link from "next/link";
import { UtensilsCrossed, ArrowRight } from "lucide-react";
import { FoodEntry } from "@/lib/calculations";
import { FoodRow } from "@/components/food/food-row";
import { useStore } from "@/store/useStore";

export function TodayEntries({ todayEntries }: { todayEntries: FoodEntry[] }) {
  const openFoodDialog = useStore((state) => state.openFoodDialog);

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-heading font-bold tracking-tight text-[15px]">Makan hari ini</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">{todayEntries.length} entri tercatat</p>
        </div>
        <Link
          href="/riwayat"
          className="flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline shrink-0"
        >
          Lihat semua <ArrowRight size={14} />
        </Link>
      </div>

      {todayEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <UtensilsCrossed size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada makan tercatat</p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-4 max-w-[260px]">
            Catat manual di sini — atau nanti tinggal chat bot &quot;tadi makan nasi goreng&quot;.
          </p>
          <button
            onClick={() => openFoodDialog()}
            className="px-4 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
          >
            + Catat makan pertama
          </button>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-line-soft">
          {todayEntries.map((e) => (
            <FoodRow key={e.id} entry={e} onClick={() => openFoodDialog(e)} />
          ))}
        </div>
      )}
    </div>
  );
}
