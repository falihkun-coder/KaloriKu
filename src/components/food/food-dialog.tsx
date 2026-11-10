"use client"

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useStore } from "@/store/useStore";
import {
  MealType,
  MealItem,
  MEAL_ORDER,
  MEAL_LABELS,
  mealLabel,
  itemCount,
  withItemMacros,
  eatenTotals,
  leftoverItems,
  buildLeftover,
  cleanItemsForSave,
  fmtNum,
} from "@/lib/calculations";
import { toast } from "sonner";
import { Minus, Plus, Trash2, X } from "lucide-react";

// Pilihan porsi buat item yang gak bisa dihitung per buah (nasi, minuman, ...)
const PORTION_CHOICES: [number, string][] = [
  [1, "Semua"],
  [0.75, "¾"],
  [0.5, "½"],
  [0.25, "¼"],
  [0, "Gak"],
];

function defaultMealNow(): MealType {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
  );
  if (hour < 11) return "sarapan";
  if (hour < 15) return "siang";
  if (hour < 18) return "snack";
  if (hour < 22) return "malam";
  return "snack";
}

// datetime-local value dari Date (pakai timezone browser, user target = WIB)
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FormState = {
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  portion: string;
  meal: MealType;
  datetime: string;
};

const emptyForm = (): FormState => ({
  name: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  portion: "1 porsi",
  meal: defaultMealNow(),
  datetime: toLocalInputValue(new Date()),
});

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-[10px] text-[13px] font-medium border transition-colors ${
        active ? "bg-white text-primary border-white" : "bg-white/10 text-white/80 border-white/25 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function FoodDialog() {
  const isOpen = useStore((state) => state.foodDialogOpen);
  const editingEntry = useStore((state) => state.editingEntry);
  const closeFoodDialog = useStore((state) => state.closeFoodDialog);
  const addEntry = useStore((state) => state.addEntry);
  const updateEntry = useStore((state) => state.updateEntry);
  const deleteEntry = useStore((state) => state.deleteEntry);

  const meals = useStore((state) => state.meals);
  const addMeal = useStore((state) => state.addMeal);
  const addLeftover = useStore((state) => state.addLeftover);
  const updateMeal = useStore((state) => state.updateMeal);
  const deleteMeal = useStore((state) => state.deleteMeal);

  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveFav, setSaveFav] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  // Isi paket yang beneran dimakan (mis. PaNas 2 tapi ayamnya cuma 1)
  const [itemsDraft, setItemsDraft] = useState<MealItem[] | null>(null);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [macrosEstimated, setMacrosEstimated] = useState(false);
  const [saveLeftover, setSaveLeftover] = useState(true);

  // Punya id = edit entri lama; tanpa id = draft baru (mis. hasil scan AI)
  const isEditing = !!editingEntry?.id;
  const isDraft = !!editingEntry && !editingEntry.id;

  // Re-init form tiap dialog dibuka / entry yang diedit ganti
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = isOpen ? editingEntry?.id ?? (isDraft ? "draft" : "new") : null;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (isOpen) {
      setSaveFav(false);
      setItemsTouched(false);
      setSaveLeftover(true);
      if (editingEntry?.items && editingEntry.items.length > 0) {
        // Lengkapin makro per item (kalau belum ada) dari total entri, biar bisa dihitung ulang per item
        const filled = withItemMacros(editingEntry.items, {
          kcal: editingEntry.kcal || 0,
          protein_g: editingEntry.protein_g || 0,
          carbs_g: editingEntry.carbs_g || 0,
          fat_g: editingEntry.fat_g || 0,
        });
        setItemsDraft(filled.items);
        setMacrosEstimated(filled.estimated);
      } else {
        setItemsDraft(null);
        setMacrosEstimated(false);
      }
      setForm(
        editingEntry
          ? {
              name: editingEntry.name || "",
              kcal: editingEntry.kcal != null ? String(editingEntry.kcal) : "",
              protein: editingEntry.protein_g != null ? String(editingEntry.protein_g) : "",
              carbs: editingEntry.carbs_g != null ? String(editingEntry.carbs_g) : "",
              fat: editingEntry.fat_g != null ? String(editingEntry.fat_g) : "",
              portion: editingEntry.portion || "1 porsi",
              meal: editingEntry.meal || defaultMealNow(),
              datetime: toLocalInputValue(editingEntry.createdAt ? new Date(editingEntry.createdAt) : new Date()),
            }
          : emptyForm()
      );
    }
  }

  // Ubah porsi 1 item yang dimakan → total kalori & makro di form ikut dihitung ulang
  const setEaten = (index: number, value: number) => {
    if (!itemsDraft) return;
    const next = itemsDraft.map((it, i) => (i === index ? { ...it, eaten: value } : it));
    setItemsDraft(next);
    setItemsTouched(true);
    const t = eatenTotals(next);
    setForm((f) => ({
      ...f,
      kcal: String(t.kcal),
      protein: String(t.protein_g),
      carbs: String(t.carbs_g),
      fat: String(t.fat_g),
    }));
  };

  const restItems = itemsDraft ? leftoverItems(itemsDraft) : [];
  const existingLeftover = editingEntry?.leftoverMealId
    ? meals.find((m) => m.id === editingEntry.leftoverMealId && m.leftover)
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        kcal: Number(form.kcal) || 0,
        protein_g: Number(form.protein) || 0,
        carbs_g: Number(form.carbs) || 0,
        fat_g: Number(form.fat) || 0,
        portion: form.portion.trim() || "1 porsi",
        meal: form.meal,
        createdAt: new Date(form.datetime).toISOString(),
      };
      // Isi paket cuma ditulis ulang kalau porsinya beneran diubah
      const items = itemsTouched && itemsDraft ? cleanItemsForSave(itemsDraft) : undefined;

      // Sisa makanan: bikin baru / update yang udah ada / hapus kalau udah gak ada sisa
      let leftoverId: string | undefined;
      if (itemsTouched && itemsDraft) {
        const leftover = saveLeftover ? buildLeftover({ name: payload.name, createdAt: payload.createdAt }, itemsDraft) : null;
        if (leftover && existingLeftover) {
          await updateMeal(existingLeftover.id, { ...leftover, items: leftover.items ?? [] });
          leftoverId = existingLeftover.id;
        } else if (leftover) {
          leftoverId = await addLeftover(leftover);
        } else if (existingLeftover) {
          await deleteMeal(existingLeftover.id);
        }
      }
      const savedLeftover = leftoverId ? " — sisanya disimpan 🥡" : "";

      if (isEditing && editingEntry?.id) {
        await updateEntry(editingEntry.id, {
          ...payload,
          ...(items && { items }),
          ...(leftoverId && { leftoverMealId: leftoverId }),
        });
        toast.success(`Entri diupdate${savedLeftover}!`);
      } else {
        const draftItems = items ?? (editingEntry?.items && editingEntry.items.length > 0 ? editingEntry.items : undefined);
        await addEntry({
          ...payload,
          source: editingEntry?.source || "manual",
          ...(editingEntry?.confidence != null && { confidence: editingEntry.confidence }),
          ...(draftItems && { items: draftItems }),
          ...(leftoverId && { leftoverMealId: leftoverId }),
        });
        if (saveFav) {
          await addMeal({
            name: payload.name,
            kcal: payload.kcal,
            protein_g: payload.protein_g,
            carbs_g: payload.carbs_g,
            fat_g: payload.fat_g,
            portion: payload.portion,
          });
        }
        toast.success(`Makan tercatat${savedLeftover}!`);
      }
      closeFoodDialog();
    } catch {
      toast.error(isEditing ? "Gagal update entri" : "Gagal catat makan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry?.id) return;
    if (!window.confirm("Yakin mau hapus entri ini?")) return;
    setIsDeleting(true);
    try {
      await deleteEntry(editingEntry.id);
      toast.success("Entri dihapus!");
      closeFoodDialog();
    } catch {
      toast.error("Gagal hapus entri");
    } finally {
      setIsDeleting(false);
    }
  };

  const busy = loading || isDeleting;
  const fieldCls =
    "w-full rounded-[12px] bg-white text-neutral-900 px-3.5 py-3 text-sm outline-none border border-white/15 placeholder:text-neutral-400 focus:border-white [color-scheme:light]";
  const labelCls = "text-[12px] font-medium text-white/75";

  const formEl = (
    <form onSubmit={handleSubmit} className="space-y-5 mt-4">
      {/* Chip estimasi AI — konfirmasi/edit wajib sebelum simpan (brief §08) */}
      {isDraft && editingEntry?.confidence != null && (
        <div className="rounded-[12px] bg-white/15 border border-white/25 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px]">✨</span>
            <p className="text-[12px] text-white/90 font-medium">
              Estimasi AI (yakin {Math.round(editingEntry.confidence * 100)}%) — cek & koreksi dulu sebelum simpan.
            </p>
          </div>
        </div>
      )}
      {/* Chips favorit — 1-tap isi form dari library (sisa makanan punya tempat sendiri) */}
      {!isEditing && !isDraft && meals.some((m) => !m.leftover) && (
        <div className="space-y-1.5">
          <label className={labelCls}>Favorit</label>
          <div className="flex flex-wrap gap-2">
            {meals.filter((m) => !m.leftover).slice(0, 6).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    name: mealLabel(m),
                    kcal: String(m.kcal),
                    protein: String(m.protein_g),
                    carbs: String(m.carbs_g),
                    fat: String(m.fat_g),
                    portion: m.portion || "1 porsi",
                  })
                }
                title={mealLabel(m)}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white/10 text-white/90 border border-white/25 hover:bg-white/20 transition-colors"
              >
                ⭐ {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nama makanan */}
      <div className="space-y-1.5">
        <label className={labelCls}>Makan apa?</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nasi goreng, ayam geprek, ..."
          required
          autoFocus={!isMobile}
          className={fieldCls}
        />
      </div>

      {/* Isi paket yang beneran dimakan — total di bawah ikut dihitung ulang */}
      {itemsDraft && itemsDraft.length > 0 && (
        <div className="space-y-1.5">
          <label className={labelCls}>Isi yang beneran dimakan</label>
          <div className="rounded-[14px] bg-white/10 border border-white/20 divide-y divide-white/15">
            {itemsDraft.map((it, i) => {
              const count = itemCount(it.name);
              const eaten = it.eaten ?? 1;
              const pieces = count ? Math.round(eaten * count) : 0;
              return (
                <div key={i} className="px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[13px] font-medium ${eaten === 0 ? "line-through text-white/45" : "text-white"}`}
                    >
                      {it.name}
                    </span>
                    <span className="text-[12px] font-bold tabular-nums shrink-0 text-white">
                      {fmtNum(it.kcal * eaten)} kkal
                    </span>
                  </div>
                  {count ? (
                    // Item yang bisa dihitung per buah: "1 dari 2"
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEaten(i, Math.max(0, pieces - 1) / count)}
                        disabled={pieces <= 0}
                        aria-label={`Kurangi ${it.name}`}
                        className="h-8 w-8 rounded-[9px] bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-35"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-[12px] text-white/90 tabular-nums min-w-[96px] text-center">
                        {pieces} dari {count} dimakan
                      </span>
                      <button
                        type="button"
                        onClick={() => setEaten(i, Math.min(count, pieces + 1) / count)}
                        disabled={pieces >= count}
                        aria-label={`Tambah ${it.name}`}
                        className="h-8 w-8 rounded-[9px] bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-35"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    // Nasi, minuman, dll: pilih porsinya
                    <div className="flex flex-wrap gap-1.5">
                      {PORTION_CHOICES.map(([value, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setEaten(i, value)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                            Math.abs(eaten - value) < 0.01
                              ? "bg-white text-primary border-white"
                              : "bg-white/10 text-white/80 border-white/25 hover:bg-white/20"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {itemsTouched && macrosEstimated && (
            <p className="text-[11px] text-white/65">Makro per item diperkirakan dari porsi kalorinya.</p>
          )}

          {/* Sisa yang gak kemakan → simpan biar nanti tinggal 1-tap */}
          {restItems.length > 0 && (
            <div className="rounded-[12px] bg-white/10 border border-white/20 px-3 py-2.5 space-y-2">
              <p className="text-[12px] text-white/90">
                🥡 Sisa: <span className="font-semibold">{restItems.map((r) => r.name).join(" + ")}</span> ·{" "}
                {fmtNum(restItems.reduce((s, r) => s + r.kcal, 0))} kkal
              </p>
              {itemsTouched ? (
                <button
                  type="button"
                  onClick={() => setSaveLeftover(!saveLeftover)}
                  className={`flex items-center gap-2 text-[12px] font-medium transition-colors ${
                    saveLeftover ? "text-white" : "text-white/60 hover:text-white/85"
                  }`}
                >
                  <span
                    className={`rounded-[6px] border flex items-center justify-center text-[10px] ${
                      saveLeftover ? "bg-white text-primary border-white" : "border-white/40"
                    }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {saveLeftover ? "✓" : ""}
                  </span>
                  Simpan sisanya — nanti tinggal 1-tap catat
                </button>
              ) : (
                <p className="text-[11px] text-white/65">
                  {existingLeftover
                    ? "Sisanya ada di 🥡 Sisa makanan, tinggal dicatat pas dimakan."
                    : "Sisanya gak ada di daftar sisa. Mau disimpan? Tap porsinya lagi."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Kalori */}
      <div className="space-y-1.5">
        <label className={labelCls}>Kalori</label>
        <div className="flex items-center rounded-[12px] bg-white px-3.5 border border-white/15">
          <input
            type="number"
            min="0"
            value={form.kcal}
            onChange={(e) => setForm({ ...form, kcal: e.target.value })}
            required
            placeholder="0"
            className="flex-1 bg-transparent py-3 outline-none font-heading font-bold tabular-nums text-lg text-neutral-900 placeholder:text-neutral-300"
          />
          <span className="text-neutral-500 text-sm font-medium ml-1">kkal</span>
        </div>
      </div>

      {/* Macro */}
      <div className="space-y-1.5">
        <label className={labelCls}>Makro (gram)</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["protein", "Protein"],
            ["carbs", "Karbo"],
            ["fat", "Lemak"],
          ] as const).map(([key, label]) => (
            <div key={key} className="rounded-[12px] bg-white border border-white/15 px-3 py-2">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{label}</p>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder="0"
                className="w-full bg-transparent outline-none font-heading font-bold tabular-nums text-[15px] text-neutral-900 placeholder:text-neutral-300 [color-scheme:light]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Waktu makan pills */}
      <div className="space-y-1.5">
        <label className={labelCls}>Waktu makan</label>
        <div className="flex flex-wrap gap-2">
          {MEAL_ORDER.map((m) => (
            <Pill key={m} active={form.meal === m} onClick={() => setForm({ ...form, meal: m })}>
              {MEAL_LABELS[m]}
            </Pill>
          ))}
        </div>
      </div>

      {/* Porsi + tanggal */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className={labelCls}>Porsi</label>
          <input
            value={form.portion}
            onChange={(e) => setForm({ ...form, portion: e.target.value })}
            placeholder="1 porsi"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Kapan</label>
          <input
            type="datetime-local"
            value={form.datetime}
            onChange={(e) => setForm({ ...form, datetime: e.target.value })}
            required
            className={fieldCls}
          />
        </div>
      </div>

      {/* Simpan ke favorit */}
      {!isEditing && (
        <button
          type="button"
          onClick={() => setSaveFav(!saveFav)}
          className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${
            saveFav ? "text-white" : "text-white/60 hover:text-white/85"
          }`}
        >
          <span
            className={`h-4.5 w-4.5 rounded-[6px] border flex items-center justify-center text-[10px] ${
              saveFav ? "bg-white text-primary border-white" : "border-white/40"
            }`}
            style={{ width: 18, height: 18 }}
          >
            {saveFav ? "✓" : ""}
          </span>
          Simpan ke favorit juga (biar next time 1-tap)
        </button>
      )}

      {/* Actions */}
      <div className="pt-2 flex gap-3">
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            aria-label="Hapus"
            className="h-11 w-11 rounded-[12px] border border-white/25 flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-50"
          >
            <Trash2 size={17} />
          </button>
        )}
        <button
          type="button"
          onClick={closeFoodDialog}
          disabled={busy}
          className="flex-1 h-11 rounded-[12px] border border-white/30 text-sm font-semibold text-white hover:bg-white/15 transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 h-11 rounded-[12px] bg-white text-primary text-sm font-semibold shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );

  const title = isEditing ? "Edit entri makan" : "Catat makan";

  // Mobile: bottom sheet. Desktop: accent dialog. (brief §04)
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && closeFoodDialog()}>
        <DrawerContent className="border-0 bg-primary text-primary-foreground max-h-[92vh]">
          <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative overflow-y-auto px-5 pb-8 pt-1">
            <DrawerTitle className="font-heading text-lg text-white">{title}</DrawerTitle>
            {formEl}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeFoodDialog()}>
      <DialogContent
        showCloseButton={false}
        className="block sm:max-w-md w-[92%] mx-auto p-0 overflow-hidden border-0 ring-0 rounded-[24px] bg-primary text-primary-foreground max-h-[90vh]"
      >
        <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-white/[0.07]" />
        <DialogClose
          aria-label="Tutup"
          render={<button className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors" />}
        >
          <X size={16} />
        </DialogClose>

        <div className="relative max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-white">{title}</DialogTitle>
          </DialogHeader>
          {formEl}
        </div>
      </DialogContent>
    </Dialog>
  );
}
