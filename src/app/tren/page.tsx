"use client";

import { useState } from "react";
import { TrendingUp, Scale, Plus, Trash2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { dailyKcalSeries, dateKeyWIB, fmtNum } from "@/lib/calculations";
import { toast } from "sonner";

function dayShort(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

export default function TrenPage() {
  const entries = useStore((state) => state.entries);
  const goals = useStore((state) => state.goals);
  const weights = useStore((state) => state.weights);
  const addWeight = useStore((state) => state.addWeight);
  const deleteWeight = useStore((state) => state.deleteWeight);

  const [kg, setKg] = useState("");
  const [date, setDate] = useState(dateKeyWIB());
  const [saving, setSaving] = useState(false);

  const kcalSeries = dailyKcalSeries(entries, 14).map((d) => ({
    ...d,
    label: dayShort(d.date),
    over: d.kcal > goals.kcalTarget,
  }));

  const weightSeries = weights.map((w) => ({ ...w, label: dayShort(w.date) }));
  const latest = weights.length > 0 ? weights[weights.length - 1] : null;
  const first = weights.length > 0 ? weights[0] : null;
  const totalDiff = latest && first ? latest.kg - first.kg : 0;

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(kg);
    if (!value || value <= 0) {
      toast.error("Isi berat yang valid dulu");
      return;
    }
    setSaving(true);
    try {
      await addWeight({ kg: value, date });
      toast.success("Berat tercatat!");
      setKg("");
    } catch {
      toast.error("Gagal catat berat");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLatest = async () => {
    if (!latest) return;
    if (!window.confirm(`Hapus catatan ${latest.kg} kg (${dayShort(latest.date)})?`)) return;
    try {
      await deleteWeight(latest.id);
      toast.success("Dihapus");
    } catch {
      toast.error("Gagal hapus");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Berat & Tren"
        description="Perjalanan beratmu + pola kalori 2 minggu terakhir."
        icon={TrendingUp}
      />

      {/* Stat + input berat */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-[18px] border border-border bg-card p-4 md:p-5">
          <div
            className="h-9 w-9 rounded-[11px] flex items-center justify-center mb-3"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)" }}
          >
            <Scale size={17} />
          </div>
          <p className="text-[12px] font-medium text-muted-foreground">Berat sekarang</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
            {latest ? latest.kg : "—"} <span className="text-[13px] font-semibold text-muted-foreground">kg</span>
          </p>
          {goals.weightTarget ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              Target {goals.weightTarget} kg
              {latest ? ` · sisa ${Math.abs(latest.kg - goals.weightTarget).toFixed(1)} kg` : ""}
            </p>
          ) : null}
        </div>

        <div className="rounded-[18px] border border-border bg-card p-4 md:p-5">
          <div
            className="h-9 w-9 rounded-[11px] flex items-center justify-center mb-3"
            style={{ backgroundColor: "color-mix(in srgb, var(--positive) 14%, transparent)", color: "var(--positive)" }}
          >
            <TrendingUp size={17} />
          </div>
          <p className="text-[12px] font-medium text-muted-foreground">Perubahan total</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
            {weights.length >= 2 ? `${totalDiff > 0 ? "+" : ""}${totalDiff.toFixed(1)}` : "—"}{" "}
            <span className="text-[13px] font-semibold text-muted-foreground">kg</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {weights.length >= 2 && first ? `sejak ${dayShort(first.date)}` : "butuh ≥2 catatan"}
          </p>
        </div>

        <form onSubmit={handleAddWeight} className="rounded-[18px] border border-border bg-card p-4 md:p-5 space-y-2">
          <p className="text-[12px] font-medium text-muted-foreground">Catat berat</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="kg"
              className="w-20 rounded-[10px] bg-background border border-border px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary transition-colors"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 min-w-0 rounded-[10px] bg-background border border-border px-2.5 py-2 text-[13px] outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-1.5 flex-1 h-9 rounded-[10px] bg-primary text-primary-foreground text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <Plus size={14} /> Simpan
            </button>
            {latest && (
              <button
                type="button"
                onClick={handleDeleteLatest}
                aria-label="Hapus catatan terakhir"
                className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Chart berat */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
        <p className="font-heading font-bold tracking-tight text-[15px]">Tren berat</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 mb-3">
          {weights.length < 2 ? "Catat berat rutin (mis. tiap pagi) biar trennya kebaca." : `${weights.length} catatan`}
        </p>
        {weights.length >= 2 ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} kg`, "Berat"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                />
                {goals.weightTarget ? (
                  <ReferenceLine y={goals.weightTarget} stroke="var(--positive)" strokeDasharray="6 4" strokeWidth={1.5} />
                ) : null}
                <Line type="monotone" dataKey="kg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[120px] rounded-[14px] bg-muted/40 flex items-center justify-center text-[13px] text-muted-foreground">
            Belum cukup data buat chart
          </div>
        )}
      </div>

      {/* Chart kalori 14 hari */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
        <p className="font-heading font-bold tracking-tight text-[15px]">Kalori 14 hari terakhir</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 mb-3">
          Garis putus-putus = target {fmtNum(goals.kcalTarget)} kkal
        </p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kcalSeries} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v) => [`${fmtNum(Number(v))} kkal`, "Masuk"]}
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
              />
              <ReferenceLine y={goals.kcalTarget} stroke="var(--muted-foreground)" strokeDasharray="6 4" strokeWidth={1.5} />
              <Bar dataKey="kcal" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {kcalSeries.map((d) => (
                  <Cell key={d.date} fill={d.over ? "var(--destructive)" : "var(--primary)"} fillOpacity={d.kcal === 0 ? 0.15 : 0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
