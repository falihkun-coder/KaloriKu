"use client";

import { useState } from "react";
import { BookMarked, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { SavedMeal, fmtNum } from "@/lib/calculations";
import { toast } from "sonner";

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function LibraryPage() {
  const meals = useStore((state) => state.meals);
  const logMeal = useStore((state) => state.logMeal);
  const deleteMeal = useStore((state) => state.deleteMeal);
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleLog = async (meal: SavedMeal) => {
    setBusyId(meal.id);
    try {
      await logMeal(meal);
      toast.success(`${meal.name} tercatat! 🍽️`);
    } catch {
      toast.error("Gagal catat");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (meal: SavedMeal) => {
    if (!window.confirm(`Hapus "${meal.name}" dari favorit?`)) return;
    try {
      await deleteMeal(meal.id);
      toast.success("Dihapus dari favorit");
    } catch {
      toast.error("Gagal hapus");
    }
  };

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Meal Library"
        description="Makanan langganan — catat ulang cukup 1 tap, tanpa AI."
        icon={BookMarked}
      />

      {meals.length === 0 ? (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <UtensilsCrossed size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada favorit</p>
          <p className="text-[12px] text-muted-foreground mt-1 mb-4 max-w-[300px]">
            Pas catat makan, centang &quot;Simpan ke favorit juga&quot; — makanan langganan bakal muncul di sini
            dan jadi chips 1-tap di form catat makan.
          </p>
          <button
            onClick={() => openFoodDialog()}
            className="px-4 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
          >
            + Catat makan
          </button>
        </div>
      ) : (
        <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
          <div className="divide-y divide-line-soft">
            {meals.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="h-[42px] w-[42px] rounded-[12px] bg-accent text-primary flex items-center justify-center text-[13px] font-bold shrink-0">
                  {initials(m.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{m.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                    {fmtNum(m.kcal)} kkal · P {fmtNum(m.protein_g)} · K {fmtNum(m.carbs_g)} · L {fmtNum(m.fat_g)} g
                    {m.useCount ? ` · ${m.useCount}x dicatat` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleLog(m)}
                  disabled={busyId === m.id}
                  className="flex items-center gap-1.5 px-3.5 h-9 rounded-[10px] bg-primary text-primary-foreground text-[12px] font-bold transition-transform active:scale-[0.97] disabled:opacity-50 shrink-0"
                >
                  <Plus size={14} /> Catat
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  aria-label={`Hapus ${m.name}`}
                  className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
