"use client";

import { useMemo, useState } from "react";
import { BookMarked, Plus, Trash2, UtensilsCrossed, Store, Loader2, Sparkles, X, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import {
  SavedMeal,
  MealItem,
  MealCategory,
  MEAL_CATEGORY_LABELS,
  MEAL_CATEGORY_ORDER,
  mealCategoryOf,
  guessMealCategory,
  fmtNum,
} from "@/lib/calculations";
import { ExtractedFood } from "@/lib/ai-extract";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_EMOJI: Record<MealCategory, string> = {
  makanan: "🍽️",
  minuman: "🥤",
  snack: "🍪",
};

type RestoDraft = {
  name: string;
  restaurant: string;
  category: MealCategory;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  portion: string;
  confidence: number;
  items?: MealItem[];
};

type CatFilter = "semua" | MealCategory;

type EditDraft = {
  id: string;
  name: string;
  restaurant: string;
  category: MealCategory;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  portion: string;
};

export default function LibraryPage() {
  const meals = useStore((state) => state.meals);
  const logMeal = useStore((state) => state.logMeal);
  const deleteMeal = useStore((state) => state.deleteMeal);
  const updateMeal = useStore((state) => state.updateMeal);
  const addMeal = useStore((state) => state.addMeal);
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Tambah menu resto: AI cariin nutrisinya dari nama menu + resto
  const [menuName, setMenuName] = useState("");
  const [restoName, setRestoName] = useState("");
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<RestoDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Filter daftar favorit
  const [catFilter, setCatFilter] = useState<CatFilter>("semua");
  const [restoFilter, setRestoFilter] = useState<string>("semua");

  // Edit favorit yang udah tersimpan
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Resto yang udah pernah dicatat — buat quick-pick, autocomplete, & filter
  const restoOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of meals) {
      const r = m.restaurant?.trim();
      if (r) counts.set(r, (counts.get(r) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [meals]);

  const filteredMeals = useMemo(() => {
    return meals.filter((m) => {
      if (catFilter !== "semua" && mealCategoryOf(m) !== catFilter) return false;
      if (restoFilter !== "semua" && (m.restaurant?.trim() || "") !== restoFilter) return false;
      return true;
    });
  }, [meals, catFilter, restoFilter]);

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
        category: guessMealCategory(menuName.trim()),
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
        category: draft.category,
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

  // Kalori total draft selalu ngikut jumlah item (biar konsisten pas disimpan)
  const setDraftItems = (items: MealItem[]) => {
    setDraft((d) =>
      d
        ? { ...d, items, ...(items.length > 0 && { kcal: String(items.reduce((s, it) => s + it.kcal, 0)) }) }
        : d
    );
  };

  const updateDraftItem = (i: number, patch: Partial<MealItem>) => {
    if (!draft?.items) return;
    setDraftItems(draft.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const removeDraftItem = (i: number) => {
    if (!draft?.items) return;
    setDraftItems(draft.items.filter((_, idx) => idx !== i));
  };

  const addDraftItem = () => {
    if (!draft) return;
    setDraftItems([...(draft.items || []), { name: "", kcal: 0 }]);
  };

  // Analisa ulang paket yang udah dicustom — AI hitung ulang kalori tiap item + makro total
  const handleReanalyze = async () => {
    if (!draft) return;
    const items = (draft.items || []).filter((it) => it.name.trim());
    if (items.length === 0) {
      toast.error("Isi dulu itemnya sebelum dianalisa ulang");
      return;
    }
    setReanalyzing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const isiPaket = items.map((it) => `- ${it.name.trim()}`).join("\n");
      const res = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          text: `Paket "${draft.name}"${draft.restaurant ? ` dari "${draft.restaurant}"` : ""} yang isinya persis seperti ini:\n${isiPaket}\n\nHitung ULANG kalori tiap item sesuai isi di atas, plus total protein/karbo/lemak buat kombinasi ini. Sertakan SEMUA item di atas di breakdown, termasuk yang 0 kalori (mis. minuman diet/zero). Kembalikan breakdown per item.`,
        }),
      });
      if (!res.ok) throw new Error(`reanalyze failed: ${res.status}`);
      const { food } = (await res.json()) as { food: ExtractedFood };
      setDraft((d) =>
        d
          ? {
              ...d,
              kcal: String(food.kcal),
              protein: String(food.protein_g),
              carbs: String(food.carbs_g),
              fat: String(food.fat_g),
              portion: food.portion || d.portion,
              confidence: food.confidence,
              // pakai breakdown baru kalau ada; kalau tinggal 1 item, breakdown ilang
              items: food.items && food.items.length > 0 ? food.items : undefined,
            }
          : d
      );
      toast.success("Paket dianalisa ulang ✨");
    } catch (err) {
      console.error(err);
      toast.error("Gagal analisa ulang — coba lagi");
    } finally {
      setReanalyzing(false);
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

  const openEdit = (m: SavedMeal) => {
    setEdit({
      id: m.id,
      name: m.name,
      restaurant: m.restaurant || "",
      category: mealCategoryOf(m),
      kcal: String(m.kcal),
      protein: String(m.protein_g),
      carbs: String(m.carbs_g),
      fat: String(m.fat_g),
      portion: m.portion || "1 porsi",
    });
  };

  const handleSaveEdit = async () => {
    if (!edit) return;
    if (!edit.name.trim()) {
      toast.error("Nama menu gak boleh kosong");
      return;
    }
    setSavingEdit(true);
    try {
      await updateMeal(edit.id, {
        name: edit.name.trim(),
        restaurant: edit.restaurant.trim() || undefined,
        category: edit.category,
        kcal: Number(edit.kcal) || 0,
        protein_g: Number(edit.protein) || 0,
        carbs_g: Number(edit.carbs) || 0,
        fat_g: Number(edit.fat) || 0,
        portion: edit.portion.trim() || "1 porsi",
      });
      toast.success("Favorit diperbarui ✏️");
      setEdit(null);
    } catch {
      toast.error("Gagal simpan perubahan");
    } finally {
      setSavingEdit(false);
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
            list="resto-options"
            className="rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
          <datalist id="resto-options">
            {restoOptions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center justify-center gap-2 px-4 h-[42px] rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {searching ? "Nyari..." : "Cari nutrisi"}
          </button>
        </form>

        {/* Quick-pick resto yang udah pernah dicatat */}
        {restoOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Resto kamu:</span>
            {restoOptions.slice(0, 6).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRestoName(r)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                  restoName.trim().toLowerCase() === r.toLowerCase()
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                🏪 {r}
              </button>
            ))}
          </div>
        )}

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

            {/* Kategori — biar gampang difilter nanti */}
            <div className="flex flex-wrap gap-2">
              {MEAL_CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, category: c })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors",
                    draft.category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {CATEGORY_EMOJI[c]} {MEAL_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            {/* Breakdown paket — bisa dicustom (ganti/tambah/hapus item) lalu analisa ulang */}
            {draft.items && draft.items.length > 0 && (
              <div className="rounded-[12px] bg-card border border-border px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Isi paket — bisa diubah
                  </p>
                  <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                    Total {fmtNum(draft.items.reduce((s, it) => s + (Number(it.kcal) || 0), 0))} kkal
                  </span>
                </div>
                <div className="space-y-1.5">
                  {draft.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={it.name}
                        onChange={(e) => updateDraftItem(i, { name: e.target.value })}
                        placeholder="mis. 1 minuman soft drink medium"
                        className="min-w-0 flex-1 rounded-[9px] bg-background border border-border px-2.5 py-1.5 text-[13px] outline-none focus:border-primary transition-colors"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          value={it.kcal || ""}
                          onChange={(e) => updateDraftItem(i, { kcal: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          className="w-[64px] rounded-[9px] bg-background border border-border px-2 py-1.5 text-[13px] text-right tabular-nums outline-none focus:border-primary transition-colors"
                        />
                        <span className="text-[11px] text-muted-foreground">kkal</span>
                        <button
                          type="button"
                          onClick={() => removeDraftItem(i)}
                          aria-label={`Hapus ${it.name || "item"}`}
                          className="h-7 w-7 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={addDraftItem}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-[9px] border border-border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Plus size={13} /> Tambah item
                  </button>
                  <button
                    type="button"
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-[9px] bg-primary text-primary-foreground text-[12px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
                  >
                    {reanalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {reanalyzing ? "Menganalisa..." : "Analisa ulang"}
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    Ganti/tambah item, terus analisa ulang biar AI hitung ulang kalori & makronya.
                  </span>
                </div>
              </div>
            )}

            {/* Jadikan paket kalau AI cuma kasih 1 angka (biar bisa dicustom jadi combo) */}
            {(!draft.items || draft.items.length === 0) && (
              <button
                type="button"
                onClick={addDraftItem}
                className="flex items-center gap-1.5 px-3 h-8 rounded-[9px] border border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Plus size={13} /> Pecah jadi paket / combo
              </button>
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
        <>
          {/* Filter: kategori + resto */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex p-1 bg-muted rounded-[12px]">
              {(["semua", ...MEAL_CATEGORY_ORDER] as CatFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors",
                    catFilter === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {c === "semua" ? "Semua" : `${CATEGORY_EMOJI[c as MealCategory]} ${MEAL_CATEGORY_LABELS[c as MealCategory]}`}
                </button>
              ))}
            </div>

            {restoOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRestoFilter("semua")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                    restoFilter === "semua"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  Semua resto
                </button>
                {restoOptions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRestoFilter(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                      restoFilter === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    🏪 {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredMeals.length === 0 ? (
            <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-12 px-6">
              <p className="text-sm font-semibold">Gak ada favorit di filter ini</p>
              <p className="text-[12px] text-muted-foreground mt-1">Coba ganti kategori atau resto.</p>
            </div>
          ) : (
            <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
              <div className="divide-y divide-line-soft">
                {filteredMeals.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <div className="h-[42px] w-[42px] rounded-[12px] bg-accent text-primary flex items-center justify-center text-[15px] shrink-0">
                      {CATEGORY_EMOJI[mealCategoryOf(m)]}
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
                      onClick={() => openEdit(m)}
                      aria-label={`Edit ${m.name}`}
                      className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
                    >
                      <Pencil size={14} />
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
        </>
      )}

      {/* Modal edit favorit */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !savingEdit && setEdit(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card border border-border rounded-t-[24px] sm:rounded-[22px] p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
                  <Pencil size={16} />
                </div>
                <div>
                  <p className="font-heading font-bold tracking-tight text-[15px]">Edit favorit</p>
                  <p className="text-[12px] text-muted-foreground">Ubah nama, kategori, atau angka gizinya.</p>
                </div>
              </div>
              <button
                onClick={() => setEdit(null)}
                aria-label="Tutup"
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Nama menu</span>
                <input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Resto (opsional)</span>
                <input
                  value={edit.restaurant}
                  onChange={(e) => setEdit({ ...edit, restaurant: e.target.value })}
                  placeholder="—"
                  list="resto-options"
                  className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </label>
            </div>

            {/* Kategori */}
            <div className="flex flex-wrap gap-2">
              {MEAL_CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEdit({ ...edit, category: c })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors",
                    edit.category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {CATEGORY_EMOJI[c]} {MEAL_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            <label className="space-y-1 block">
              <span className="text-[11px] font-semibold text-muted-foreground">Porsi</span>
              <input
                value={edit.portion}
                onChange={(e) => setEdit({ ...edit, portion: e.target.value })}
                placeholder="1 porsi"
                className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </label>

            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["kcal", "kkal"],
                  ["protein", "P (g)"],
                  ["carbs", "K (g)"],
                  ["fat", "L (g)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="rounded-[12px] bg-background border border-border px-3 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={edit[key]}
                    onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                    className="w-full bg-transparent outline-none font-heading font-bold tabular-nums text-[15px]"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEdit(null)}
                disabled={savingEdit}
                className="flex-1 h-10 rounded-[12px] border border-border text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-[2] flex items-center justify-center gap-2 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {savingEdit ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
                {savingEdit ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
