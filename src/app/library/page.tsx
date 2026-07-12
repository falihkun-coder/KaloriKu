"use client";

import { useState } from "react";
import { BookMarked, Plus, Trash2, UtensilsCrossed, Store, Loader2, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { SavedMeal, MealItem, fmtNum, mealLabel } from "@/lib/calculations";
import { ExtractedFood } from "@/lib/ai-extract";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

type RestoDraft = {
  name: string;
  restaurant: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  portion: string;
  confidence: number;
  items?: MealItem[];
};

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function LibraryPage() {
  const meals = useStore((state) => state.meals);
  const logMeal = useStore((state) => state.logMeal);
  const deleteMeal = useStore((state) => state.deleteMeal);
  const addMeal = useStore((state) => state.addMeal);
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Tambah menu resto: AI cariin nutrisinya dari nama menu + resto
  const [menuName, setMenuName] = useState("");
  const [restoName, setRestoName] = useState("");
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<RestoDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName.trim() || !restoName.trim()) {
      toast.error("Isi nama menu + nama restonya dulu");
      return;
    }
    setSearching(true);
    setDraft(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          text: `Menu "${menuName.trim()}" dari restoran/warung "${restoName.trim()}" — 1 porsi standar menu resto tersebut. Kalau kamu tahu menu resto ini (mis. chain besar), pakai data resminya.`,
        }),
      });
      if (!res.ok) throw new Error(`scan failed: ${res.status}`);
      const { food } = (await res.json()) as { food: ExtractedFood };
      setDraft({
        name: menuName.trim(),
        restaurant: restoName.trim(),
        kcal: String(food.kcal),
        protein: String(food.protein_g),
        carbs: String(food.carbs_g),
        fat: String(food.fat_g),
        portion: food.portion || "1 porsi",
        confidence: food.confidence,
        items: food.items,
      });
    } catch (err) {
      console.error(err);
      toast.error("Gagal cari info nutrisi — coba lagi atau tulis lebih spesifik");
    } finally {
      setSearching(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    setSavingDraft(true);
    try {
      await addMeal({
        name: draft.name,
        restaurant: draft.restaurant,
        kcal: Number(draft.kcal) || 0,
        protein_g: Number(draft.protein) || 0,
        carbs_g: Number(draft.carbs) || 0,
        fat_g: Number(draft.fat) || 0,
        portion: draft.portion,
        ...(draft.items && draft.items.length > 0 && { items: draft.items }),
      });
      toast.success(`${draft.name} (${draft.restaurant}) masuk favorit! ⭐`);
      setDraft(null);
      setMenuName("");
      setRestoName("");
    } catch {
      toast.error("Gagal simpan ke favorit");
    } finally {
      setSavingDraft(false);
    }
  };

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

      {/* Tambah menu resto via AI */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
            <Store size={17} />
          </div>
          <div>
            <p className="font-heading font-bold tracking-tight text-[15px]">Tambah menu resto</p>
            <p className="text-[12px] text-muted-foreground">
              Tinggal nama menu + restonya — AI yang cariin kalori & makronya.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={menuName}
            onChange={(e) => setMenuName(e.target.value)}
            placeholder="Nama menu — mis. Big Mac"
            className="rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
          <input
            value={restoName}
            onChange={(e) => setRestoName(e.target.value)}
            placeholder="Resto — mis. McDonald's"
            className="rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            disabled={searching}
            className="flex items-center justify-center gap-2 px-4 h-[42px] rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {searching ? "Nyari..." : "Cari nutrisi"}
          </button>
        </form>

        {draft && (
          <div className="rounded-[16px] border border-primary/30 bg-accent/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">
                  {draft.name} <span className="font-medium text-muted-foreground">· {draft.restaurant}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ✨ Estimasi AI (yakin {Math.round(draft.confidence * 100)}%) · {draft.portion} — koreksi angkanya kalau perlu
                </p>
              </div>
              <button
                onClick={() => setDraft(null)}
                aria-label="Tutup"
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Breakdown per item — bukti AI reference menu yang bener */}
            {draft.items && draft.items.length > 0 && (
              <div className="rounded-[12px] bg-card border border-border px-3.5 py-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Breakdown paket
                </p>
                <div className="space-y-1.5">
                  {draft.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="text-foreground">{it.name}</span>
                      <span className="font-semibold tabular-nums shrink-0">{fmtNum(it.kcal)} kkal</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 text-[13px] pt-1.5 border-t border-line-soft">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold tabular-nums">
                      {fmtNum(draft.items.reduce((s, it) => s + it.kcal, 0))} kkal
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["kcal", "kkal"],
                  ["protein", "P (g)"],
                  ["carbs", "K (g)"],
                  ["fat", "L (g)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="rounded-[12px] bg-card border border-border px-3 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    className="w-full bg-transparent outline-none font-heading font-bold tabular-nums text-[15px]"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <Plus size={15} />
              {savingDraft ? "Menyimpan..." : "Simpan ke favorit"}
            </button>
          </div>
        )}
      </div>

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
                  <p className="text-sm font-bold truncate">
                    {m.name}
                    {m.restaurant && <span className="font-medium text-muted-foreground"> · {m.restaurant}</span>}
                  </p>
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
