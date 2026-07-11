"use client";

import { useEffect, useState } from "react";
import { Target, LogOut, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { Goals } from "@/lib/calculations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentToggle } from "@/components/accent-toggle";
import { useAuth } from "@/components/auth-provider";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ACTIVITY_LEVELS: { id: NonNullable<Goals["activityLevel"]>; label: string; hint: string }[] = [
  { id: "rendah", label: "Rendah", hint: "Jarang olahraga" },
  { id: "sedang", label: "Sedang", hint: "Olahraga 1–3x/minggu" },
  { id: "tinggi", label: "Tinggi", hint: "Olahraga 4x+/minggu" },
];

type Field = { key: "kcalTarget" | "proteinTarget" | "carbsTarget" | "fatTarget" | "weightTarget"; label: string; unit: string };

const FIELDS: Field[] = [
  { key: "kcalTarget", label: "Target kalori harian", unit: "kkal" },
  { key: "proteinTarget", label: "Target protein", unit: "g" },
  { key: "carbsTarget", label: "Target karbo", unit: "g" },
  { key: "fatTarget", label: "Target lemak", unit: "g" },
  { key: "weightTarget", label: "Target berat badan", unit: "kg" },
];

export default function GoalsPage() {
  const goals = useStore((state) => state.goals);
  const updateGoals = useStore((state) => state.updateGoals);
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<Field["key"], string>>({
    kcalTarget: "",
    proteinTarget: "",
    carbsTarget: "",
    fatTarget: "",
    weightTarget: "",
  });
  const [activity, setActivity] = useState<Goals["activityLevel"]>("sedang");

  useEffect(() => {
    setForm({
      kcalTarget: String(goals.kcalTarget ?? ""),
      proteinTarget: String(goals.proteinTarget ?? ""),
      carbsTarget: String(goals.carbsTarget ?? ""),
      fatTarget: String(goals.fatTarget ?? ""),
      weightTarget: goals.weightTarget ? String(goals.weightTarget) : "",
    });
    setActivity(goals.activityLevel || "sedang");
  }, [goals]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGoals({
        kcalTarget: Number(form.kcalTarget) || 0,
        proteinTarget: Number(form.proteinTarget) || 0,
        carbsTarget: Number(form.carbsTarget) || 0,
        fatTarget: Number(form.fatTarget) || 0,
        ...(form.weightTarget ? { weightTarget: Number(form.weightTarget) } : {}),
        activityLevel: activity,
      });
      toast.success("Goals tersimpan!");
    } catch {
      toast.error("Gagal simpan goals");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Goals & Setting"
        description="Target harian, aktivitas, dan tampilan aplikasi."
        icon={Target}
      />

      <form onSubmit={handleSave} className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-5">
        <div>
          <p className="font-heading font-bold tracking-tight text-[15px]">Target harian</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Angka ini jadi acuan sisa kalori & progress makro di dashboard.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div
              key={f.key}
              className={cn("space-y-1.5", f.key === "kcalTarget" && "sm:col-span-2")}
            >
              <label className="text-[12px] font-medium text-muted-foreground">{f.label}</label>
              <div className="flex items-center rounded-[12px] bg-background border border-border px-3.5 focus-within:border-primary transition-colors">
                <input
                  type="number"
                  min="0"
                  step={f.key === "weightTarget" ? "0.1" : "1"}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  required={f.key !== "weightTarget"}
                  placeholder={f.key === "weightTarget" ? "opsional" : "0"}
                  className="flex-1 bg-transparent py-3 outline-none font-heading font-bold tabular-nums text-[15px]"
                />
                <span className="text-muted-foreground text-[13px] font-medium ml-2">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-muted-foreground">Level aktivitas</label>
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActivity(a.id)}
                className={cn(
                  "rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                  activity === a.id
                    ? "border-primary bg-accent text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                <p className={cn("text-[13px] font-semibold", activity === a.id && "text-primary")}>{a.label}</p>
                <p className="text-[11px] mt-0.5">{a.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Menyimpan..." : "Simpan goals"}
        </button>
      </form>

      {/* Tampilan — penting di mobile karena sidebar (yang punya toggle) desktop-only */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-4">
        <p className="font-heading font-bold tracking-tight text-[15px]">Tampilan</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Warna aksen</span>
          <AccentToggle />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tema gelap / terang</span>
          <ThemeToggle className="h-9 w-9" />
        </div>
      </div>

      {/* Akun */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading font-bold tracking-tight text-[15px]">Akun</p>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 px-3.5 h-10 rounded-[12px] border border-border text-[13px] font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
        >
          <LogOut size={15} />
          Keluar
        </button>
      </div>
    </div>
  );
}
