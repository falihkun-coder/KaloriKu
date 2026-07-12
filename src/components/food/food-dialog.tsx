"use client"

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useStore } from "@/store/useStore";
import { MealType, MEAL_ORDER, MEAL_LABELS } from "@/lib/calculations";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";

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

  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveFav, setSaveFav] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

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
      if (isEditing && editingEntry?.id) {
        await updateEntry(editingEntry.id, payload);
        toast.success("Entri diupdate!");
      } else {
        await addEntry({
          ...payload,
          source: editingEntry?.source || "manual",
          ...(editingEntry?.confidence != null && { confidence: editingEntry.confidence }),
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
        toast.success("Makan tercatat!");
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
        <div className="flex items-center gap-2 rounded-[12px] bg-white/15 border border-white/25 px-3 py-2">
          <span className="text-[13px]">✨</span>
          <p className="text-[12px] text-white/90 font-medium">
            Estimasi AI (yakin {Math.round(editingEntry.confidence * 100)}%) — cek & koreksi dulu sebelum simpan.
          </p>
        </div>
      )}
      {/* Chips favorit — 1-tap isi form dari library */}
      {!isEditing && !isDraft && meals.length > 0 && (
        <div className="space-y-1.5">
          <label className={labelCls}>Favorit</label>
          <div className="flex flex-wrap gap-2">
            {meals.slice(0, 6).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    name: m.name,
                    kcal: String(m.kcal),
                    protein: String(m.protein_g),
                    carbs: String(m.carbs_g),
                    fat: String(m.fat_g),
                    portion: m.portion || "1 porsi",
                  })
                }
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
