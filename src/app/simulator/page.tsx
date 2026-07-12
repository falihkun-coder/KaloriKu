"use client";

import { useState } from "react";
import { Calculator, Loader2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { auth } from "@/lib/firebase";
import { consumedToday, budgetBurned, fmtNum } from "@/lib/calculations";
import { simulateFit, FitResult } from "@/lib/simulate-fit";
import { ExtractedFood } from "@/lib/ai-extract";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VERDICT_STYLE = {
  safe: { color: "var(--positive)", emoji: "🟢" },
  caution: { color: "var(--carbs)", emoji: "🟠" },
  danger: { color: "var(--destructive)", emoji: "🔴" },
} as const;

export default function SimulatorPage() {
  const entries = useStore((state) => state.entries);
  const goals = useStore((state) => state.goals);
  const exercises = useStore((state) => state.exercises);
  const openFoodDialog = useStore((state) => state.openFoodDialog);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(FitResult & { food?: ExtractedFood }) | null>(null);

  const consumed = consumedToday(entries);
  const burned = budgetBurned(goals, exercises);
  const sisa = goals.kcalTarget + burned - consumed.kcal;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ text: query.trim() }),
      });
      if (!res.ok) throw new Error(`scan failed: ${res.status}`);
      const { food } = (await res.json()) as { food: ExtractedFood };
      setResult({ ...simulateFit(goals, consumed, food, burned), food });
    } catch (err) {
      console.error(err);
      toast.error("Gagal estimasi makanan — coba tulis lebih spesifik");
    } finally {
      setLoading(false);
    }
  };

  const style = result ? VERDICT_STYLE[result.level] : null;

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Muat gak di target?"
        description="Cek dulu sebelum makan — biar gak nyesel belakangan."
        icon={Calculator}
      />

      {/* Kondisi sekarang */}
      <div className="rounded-[18px] border border-border bg-card p-4 md:p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Sisa kalori hari ini</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
            {sisa >= 0 ? fmtNum(sisa) : `−${fmtNum(Math.abs(sisa))}`}{" "}
            <span className="text-[13px] font-semibold text-muted-foreground">kkal</span>
          </p>
        </div>
        <p className="text-[12px] text-muted-foreground text-right">
          {fmtNum(consumed.kcal)} / {fmtNum(goals.kcalTarget)} kkal
          <br />
          terpakai
        </p>
      </div>

      {/* Input */}
      <form onSubmit={handleSimulate} className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <label className="text-[13px] font-semibold">Mau makan apa?</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Contoh: "martabak manis 2 potong" / "mie ayam bakso"'
          className="w-full rounded-[14px] bg-background border border-border px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          {loading ? "AI lagi ngitung..." : "Muat gak?"}
        </button>
      </form>

      {/* Vonis */}
      {result && style && (
        <div
          className="rounded-[22px] border bg-card p-5 md:p-6 space-y-4"
          style={{ borderColor: `color-mix(in srgb, ${style.color} 40%, transparent)` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading font-bold tracking-tight text-[15px]">{result.name}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                ≈ {fmtNum(result.candidate.kcal)} kkal · P {fmtNum(result.candidate.protein_g)} · K{" "}
                {fmtNum(result.candidate.carbs_g)} · L {fmtNum(result.candidate.fat_g)} g
              </p>
            </div>
            <span
              className="text-[13px] font-bold px-3 py-1.5 rounded-full shrink-0"
              style={{ backgroundColor: `color-mix(in srgb, ${style.color} 14%, transparent)`, color: style.color }}
            >
              {style.emoji} {result.label}
            </span>
          </div>

          {/* Bar sebelum/sesudah */}
          <div className="space-y-2">
            <div className="flex justify-between text-[12px] text-muted-foreground">
              <span>Terpakai setelah makan ini</span>
              <span className={cn("font-semibold tabular-nums", result.pctAfter > 100 && "text-destructive")}>
                {result.pctAfter}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-line-soft overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, result.pctAfter)}%`, backgroundColor: style.color }}
              />
            </div>
            <p className="text-[13px] text-muted-foreground">{result.advice}</p>
          </div>

          <button
            onClick={() => result.food && openFoodDialog({ ...result.food, source: "chat" })}
            className="w-full h-11 rounded-[12px] border border-border text-sm font-semibold hover:border-primary/50 transition-colors"
          >
            Gas makan — langsung catat 🍽️
          </button>
        </div>
      )}
    </div>
  );
}
