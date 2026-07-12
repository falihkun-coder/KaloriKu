"use client"

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useStore } from "@/store/useStore";
import { ExerciseType, EXERCISE_ORDER, EXERCISE_LABELS } from "@/lib/calculations";
import { auth } from "@/lib/firebase";
import { ExtractedExercise } from "@/lib/exercise-extract";
import { toast } from "sonner";
import { Trash2, X, Sparkles, Loader2 } from "lucide-react";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FormState = {
  name: string;
  type: ExerciseType;
  duration: string;
  kcal: string;
  avgHr: string;
  maxHr: string;
  datetime: string;
};

const emptyForm = (): FormState => ({
  name: "",
  type: "kardio",
  duration: "",
  kcal: "",
  avgHr: "",
  maxHr: "",
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

export function ExerciseDialog() {
  const isOpen = useStore((state) => state.exerciseDialogOpen);
  const editing = useStore((state) => state.editingExercise);
  const close = useStore((state) => state.closeExerciseDialog);
  const addExercise = useStore((state) => state.addExercise);
  const updateExercise = useStore((state) => state.updateExercise);
  const deleteExercise = useStore((state) => state.deleteExercise);
  const weights = useStore((state) => state.weights);

  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const isEditing = !!editing?.id;
  const isDraft = !!editing && !editing.id;

  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = isOpen ? editing?.id ?? (isDraft ? "draft" : "new") : null;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (isOpen) {
      setForm(
        editing
          ? {
              name: editing.name || "",
              type: editing.type || "kardio",
              duration: editing.durationMin != null ? String(editing.durationMin) : "",
              kcal: editing.kcalBurned != null ? String(editing.kcalBurned) : "",
              avgHr: editing.avgHr != null ? String(editing.avgHr) : "",
              maxHr: editing.maxHr != null ? String(editing.maxHr) : "",
              datetime: toLocalInputValue(editing.createdAt ? new Date(editing.createdAt) : new Date()),
            }
          : emptyForm()
      );
    }
  }

  const handleEstimate = async () => {
    if (!form.name.trim()) {
      toast.error("Tulis nama olahraga dulu, mis. 'lari 5km 30 menit'");
      return;
    }
    setEstimating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const latestWeight = weights.length > 0 ? weights[weights.length - 1].kg : undefined;
      const res = await fetch("/api/scan-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          text: `${form.name.trim()}${form.duration ? ` ${form.duration} menit` : ""}`,
          weightKg: latestWeight,
        }),
      });
      if (!res.ok) throw new Error(`estimate failed: ${res.status}`);
      const { exercise } = (await res.json()) as { exercise: ExtractedExercise };
      setForm((f) => ({
        ...f,
        name: exercise.name,
        type: exercise.type,
        duration: exercise.durationMin ? String(exercise.durationMin) : f.duration,
        kcal: String(exercise.kcalBurned),
      }));
      toast.success(`Estimasi: ${exercise.kcalBurned} kkal (yakin ${Math.round(exercise.confidence * 100)}%)`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal estimasi — isi manual aja ya");
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        durationMin: Number(form.duration) || 0,
        kcalBurned: Number(form.kcal) || 0,
        createdAt: new Date(form.datetime).toISOString(),
        ...(form.avgHr ? { avgHr: Number(form.avgHr) } : {}),
        ...(form.maxHr ? { maxHr: Number(form.maxHr) } : {}),
      };
      if (isEditing && editing?.id) {
        await updateExercise(editing.id, payload);
        toast.success("Olahraga diupdate!");
      } else {
        await addExercise({ ...payload, source: editing?.source || "manual" });
        toast.success("Olahraga tercatat! 💪");
      }
      close();
    } catch {
      toast.error(isEditing ? "Gagal update" : "Gagal catat olahraga");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!window.confirm("Yakin mau hapus catatan olahraga ini?")) return;
    setIsDeleting(true);
    try {
      await deleteExercise(editing.id);
      toast.success("Dihapus!");
      close();
    } catch {
      toast.error("Gagal hapus");
    } finally {
      setIsDeleting(false);
    }
  };

  const busy = loading || isDeleting || estimating;
  const fieldCls =
    "w-full rounded-[12px] bg-white text-neutral-900 px-3.5 py-3 text-sm outline-none border border-white/15 placeholder:text-neutral-400 focus:border-white [color-scheme:light]";
  const labelCls = "text-[12px] font-medium text-white/75";

  const formEl = (
    <form onSubmit={handleSubmit} className="space-y-5 mt-4">
      {/* Nama + estimasi AI */}
      <div className="space-y-1.5">
        <label className={labelCls}>Olahraga apa?</label>
        <div className="flex gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Lari 5km, gym push day, ..."
            required
            autoFocus={!isMobile}
            className={fieldCls}
          />
          <button
            type="button"
            onClick={handleEstimate}
            disabled={busy}
            title="Estimasi kalori pakai AI"
            className="shrink-0 h-[46px] px-3 rounded-[12px] bg-white/15 border border-white/25 text-white flex items-center gap-1.5 text-[13px] font-semibold hover:bg-white/25 transition-colors disabled:opacity-50"
          >
            {estimating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            AI
          </button>
        </div>
      </div>

      {/* Jenis */}
      <div className="space-y-1.5">
        <label className={labelCls}>Jenis</label>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_ORDER.map((t) => (
            <Pill key={t} active={form.type === t} onClick={() => setForm({ ...form, type: t })}>
              {EXERCISE_LABELS[t]}
            </Pill>
          ))}
        </div>
      </div>

      {/* Durasi + kalori */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className={labelCls}>Durasi (menit)</label>
          <input
            type="number"
            min="0"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="0"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Kalori terbakar</label>
          <div className="flex items-center rounded-[12px] bg-white px-3.5 border border-white/15">
            <input
              type="number"
              min="0"
              value={form.kcal}
              onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              required
              placeholder="0"
              className="flex-1 min-w-0 bg-transparent py-3 outline-none font-heading font-bold tabular-nums text-lg text-neutral-900 placeholder:text-neutral-300"
            />
            <span className="text-neutral-500 text-sm font-medium ml-1">kkal</span>
          </div>
        </div>
      </div>

      {/* Heart rate (opsional) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className={labelCls}>Avg HR (opsional)</label>
          <div className="flex items-center rounded-[12px] bg-white px-3.5 border border-white/15">
            <input
              type="number"
              min="0"
              value={form.avgHr}
              onChange={(e) => setForm({ ...form, avgHr: e.target.value })}
              placeholder="—"
              className="flex-1 min-w-0 bg-transparent py-3 outline-none font-heading font-bold tabular-nums text-neutral-900 placeholder:text-neutral-300"
            />
            <span className="text-neutral-500 text-xs font-medium ml-1">bpm</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Max HR (opsional)</label>
          <div className="flex items-center rounded-[12px] bg-white px-3.5 border border-white/15">
            <input
              type="number"
              min="0"
              value={form.maxHr}
              onChange={(e) => setForm({ ...form, maxHr: e.target.value })}
              placeholder="—"
              className="flex-1 min-w-0 bg-transparent py-3 outline-none font-heading font-bold tabular-nums text-neutral-900 placeholder:text-neutral-300"
            />
            <span className="text-neutral-500 text-xs font-medium ml-1">bpm</span>
          </div>
        </div>
      </div>

      {/* Kapan */}
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
          onClick={close}
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
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );

  const title = isEditing ? "Edit olahraga" : "Catat olahraga";

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && close()}>
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
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
