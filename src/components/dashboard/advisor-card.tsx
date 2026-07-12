"use client";

import { useState } from "react";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { auth } from "@/lib/firebase";
import { MealSuggestion } from "@/lib/advisor";
import { fmtNum } from "@/lib/calculations";
import { toast } from "sonner";

export function AdvisorCard() {
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null);

  const handleAsk = async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`advisor failed: ${res.status}`);
      const data = (await res.json()) as { suggestions: MealSuggestion[] };
      setSuggestions(data.suggestions);
    } catch (e) {
      console.error(e);
      toast.error("Gagal minta saran — coba lagi bentar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-heading font-bold tracking-tight text-[15px]">Bingung mau makan apa?</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            AI saranin menu yang muat di sisa kalori & makromu.
          </p>
        </div>
        <button
          onClick={handleAsk}
          disabled={loading}
          className="flex items-center gap-2 px-4 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60 shrink-0"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {suggestions ? "Saran lain" : "Kasih saran"}
        </button>
      </div>

      {suggestions && (
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-[16px] border border-border bg-background p-4 flex flex-col">
              <p className="text-sm font-bold leading-snug">{s.name}</p>
              <p className="text-[12px] text-muted-foreground tabular-nums mt-1">
                ≈{fmtNum(s.kcal)} kkal · P {fmtNum(s.protein_g)} · K {fmtNum(s.carbs_g)} · L {fmtNum(s.fat_g)}
              </p>
              <p className="text-[12px] text-muted-foreground mt-2 flex-1">{s.reason}</p>
              <button
                onClick={() =>
                  openFoodDialog({
                    name: s.name,
                    kcal: s.kcal,
                    protein_g: s.protein_g,
                    carbs_g: s.carbs_g,
                    fat_g: s.fat_g,
                    portion: "1 porsi",
                    source: "chat",
                  })
                }
                className="mt-3 flex items-center justify-center gap-1.5 h-9 rounded-[10px] border border-primary/40 text-primary text-[12px] font-bold hover:bg-accent transition-colors"
              >
                <Plus size={13} /> Catat ini
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
