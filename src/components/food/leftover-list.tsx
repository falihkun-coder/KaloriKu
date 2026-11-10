"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SavedMeal, dateKeyWIB, shiftDateKey, fmtNum } from "@/lib/calculations";
import { toast } from "sonner";

/** "kemarin" / "tadi" / "10 Nov" dari kapan makanan aslinya dicatat. */
function fromLabel(iso?: string): string {
  if (!iso) return "";
  const day = dateKeyWIB(iso);
  const today = dateKeyWIB();
  if (day === today) return "dari tadi";
  if (day === shiftDateKey(today, -1)) return "dari kemarin";
  return `dari ${new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}`;
}

// Sisa makanan (bagian paket yang gak kemakan) — 1-tap catat pas dimakan, otomatis ilang abis dicatat.
export function LeftoverList({ leftovers }: { leftovers: SavedMeal[] }) {
  const logMeal = useStore((s) => s.logMeal);
  const deleteMeal = useStore((s) => s.deleteMeal);
  const [busy, setBusy] = useState<string | null>(null);

  const handleLog = async (m: SavedMeal) => {
    setBusy(m.id);
    try {
      await logMeal(m);
      toast.success("Sisanya tercatat! 🥡");
    } catch {
      toast.error("Gagal catat");
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async (m: SavedMeal) => {
    if (!window.confirm("Buang sisa ini? (gak dicatat sebagai makanan)")) return;
    try {
      await deleteMeal(m.id);
      toast.success("Sisa dibuang");
    } catch {
      toast.error("Gagal hapus");
    }
  };

  return (
    <div className="divide-y divide-line-soft">
      {leftovers.map((m) => {
        // Nama sisa: "<isi> · sisa <makanan asli>"
        const [contents, origin] = m.name.split(" · sisa ");
        return (
          <div key={m.id} className="flex items-center gap-3 py-3">
            <div className="h-[42px] w-[42px] rounded-[12px] bg-accent flex items-center justify-center text-[18px] shrink-0">
              🥡
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{contents}</p>
              <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                {fmtNum(m.kcal)} kkal · P {fmtNum(m.protein_g)} g
                {origin && ` · sisa ${origin}`} {fromLabel(m.leftoverFrom)}
              </p>
            </div>
            <button
              onClick={() => handleLog(m)}
              disabled={busy === m.id}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-[10px] bg-primary text-primary-foreground text-[12px] font-bold transition-transform active:scale-[0.97] disabled:opacity-50 shrink-0"
            >
              <Plus size={14} /> Catat
            </button>
            <button
              onClick={() => handleDiscard(m)}
              aria-label={`Buang sisa ${contents}`}
              title="Buang (gak dimakan)"
              className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
