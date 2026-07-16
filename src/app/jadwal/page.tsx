"use client";

import { useState } from "react";
import { CalendarDays, Dumbbell, Target, Zap, TrendingUp, Repeat, Footprints, Check, Pencil, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import {
  DayKey,
  ScheduleDay,
  WorkoutType,
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  WORKOUT_LABELS,
  WORKOUT_EMOJI,
  WORKOUT_ORDER,
  WORKOUT_TO_EXERCISE,
  todayDayKey,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ===== Referensi rencana latihan (rekap 体つくり) =====
const FULL_BODY: { cat: string; move: string; sr: string }[] = [
  { cat: "Pull vertikal", move: "Pull-up / Chin-up", sr: "3–4 × sebisanya" },
  { cat: "Push", move: "Push-up (→ diamond → archer)", sr: "3–4 × 8–15" },
  { cat: "Pull horizontal", move: "Inverted row (kolong meja)", sr: "3 × 8–12" },
  { cat: "Legs — quad", move: "Bulgarian split squat", sr: "3 × 10–12 /kaki" },
  { cat: "Legs — posterior", move: "Glute bridge / hip thrust", sr: "3 × 12–15" },
  { cat: "Core", move: "Hanging leg raise + plank", sr: "3 × sampai capek" },
];

const PULLUP_STEPS: { step: string; desc: string; star?: boolean }[] = [
  { step: "Dead hang", desc: "Gantung selama mungkin — kuatin grip + bahu (target 30 dtk)" },
  { step: "Negative pull-up", desc: "Lompat ke atas, turun pelan 3–5 detik", star: true },
  { step: "Band-assisted", desc: "Pakai band / kaki napak kursi buat bantu dikit" },
  { step: "Full pull-up", desc: "Target akhir 🎯" },
];

const OVERLOAD_CHAIN = [
  "Nambah reps",
  "Perlambat tempo (turun 3 dtk)",
  "Variasi lebih susah",
  "Kurangin istirahat",
  "Baru nambah beban (ransel)",
];

export default function JadwalPage() {
  const schedule = useStore((s) => s.schedule);
  const setScheduleDay = useStore((s) => s.setScheduleDay);
  const openExerciseDialog = useStore((s) => s.openExerciseDialog);

  const today = todayDayKey();
  const todayPlan = schedule.days[today];

  // Editor per-hari
  const [editingDay, setEditingDay] = useState<DayKey | null>(null);
  const [draftType, setDraftType] = useState<WorkoutType>("rest");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

  const openEditor = (day: DayKey) => {
    const d = schedule.days[day];
    setDraftType(d.type);
    setDraftNote(d.note || "");
    setEditingDay(day);
  };

  const saveEditor = async () => {
    if (!editingDay) return;
    setSaving(true);
    try {
      await setScheduleDay(editingDay, { type: draftType, note: draftNote });
      setEditingDay(null);
    } catch {
      toast.error("Gagal simpan jadwal");
    } finally {
      setSaving(false);
    }
  };

  const logDay = (d: ScheduleDay) => {
    openExerciseDialog({ type: WORKOUT_TO_EXERCISE[d.type], name: d.note?.trim() || WORKOUT_LABELS[d.type] });
  };

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Jadwal Olahraga"
        description="Rencana latihan mingguan — atur tiap hari, catat progresnya."
        icon={CalendarDays}
      />

      {/* Misi / target */}
      <div className="relative overflow-hidden rounded-[22px] bg-primary text-primary-foreground p-5 md:p-6">
        <div aria-hidden className="absolute -top-12 -right-8 w-44 h-44 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/80">
            <Target size={15} />
            <p className="text-[12px] font-semibold uppercase tracking-wide">Misi 体つくり</p>
          </div>
          <p className="font-heading font-bold tracking-tight text-[clamp(20px,4vw,26px)] leading-tight mt-1.5">
            75,5 kg → 67–69 kg
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[13px] text-white/85">
            <span>🎯 Deadline Oktober (~13 minggu)</span>
            <span>📉 Laju sehat ~0,5–0,6 kg/minggu</span>
          </div>
          <p className="text-[12px] text-white/70 mt-2">
            Ground truth = timbangan pagi (rata-rata mingguan). App buat panduan, timbangan buat verifikasi.
          </p>
        </div>
      </div>

      {/* Fokus hari ini */}
      <div className="rounded-[18px] border border-primary/30 bg-accent/40 px-4 py-3 flex items-center gap-3">
        <div className="h-11 w-11 rounded-[13px] bg-card border border-border flex items-center justify-center text-[22px] shrink-0">
          {WORKOUT_EMOJI[todayPlan.type]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Hari ini · {WEEKDAY_LABELS[today]}
          </p>
          <p className="font-heading font-bold text-[16px] tracking-tight truncate">
            {WORKOUT_LABELS[todayPlan.type]}
            {todayPlan.note ? <span className="font-medium text-muted-foreground"> · {todayPlan.note}</span> : ""}
          </p>
        </div>
        {todayPlan.type !== "rest" ? (
          <button
            onClick={() => logDay(todayPlan)}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-[10px] bg-primary text-primary-foreground text-[12px] font-bold transition-transform active:scale-[0.97] shrink-0"
          >
            <Dumbbell size={14} /> Catat
          </button>
        ) : (
          <span className="text-[12px] font-semibold text-muted-foreground shrink-0">Recovery 😴</span>
        )}
      </div>

      {/* Jadwal mingguan */}
      <div className="rounded-[22px] border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="font-heading font-bold tracking-tight text-[15px]">Jadwal mingguan</p>
          <p className="text-[11px] text-muted-foreground">Tap hari buat ubah</p>
        </div>

        <div className="space-y-2">
          {WEEKDAY_ORDER.map((day) => {
            const d = schedule.days[day];
            const isToday = day === today;
            const isEditing = editingDay === day;
            return (
              <div
                key={day}
                className={cn(
                  "rounded-[14px] border transition-colors",
                  isToday ? "border-primary/40 bg-accent/30" : "border-border bg-background"
                )}
              >
                {/* Baris utama */}
                <div className="flex items-center gap-3 p-2.5">
                  <div className="w-11 shrink-0 text-center">
                    <p className={cn("text-[13px] font-bold", isToday ? "text-primary" : "text-foreground")}>
                      {WEEKDAY_LABELS[day].slice(0, 3)}
                    </p>
                    {isToday && <p className="text-[9px] font-semibold text-primary uppercase">Hari ini</p>}
                  </div>
                  <div className="text-[20px] shrink-0">{WORKOUT_EMOJI[d.type]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{WORKOUT_LABELS[d.type]}</p>
                    {d.note && <p className="text-[12px] text-muted-foreground truncate">{d.note}</p>}
                  </div>
                  {d.type !== "rest" && !isEditing && (
                    <button
                      onClick={() => logDay(d)}
                      aria-label="Catat olahraga"
                      title="Catat olahraga"
                      className="h-8 w-8 rounded-[9px] border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
                    >
                      <Dumbbell size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => (isEditing ? setEditingDay(null) : openEditor(day))}
                    aria-label={`Ubah ${WEEKDAY_LABELS[day]}`}
                    className={cn(
                      "h-8 w-8 rounded-[9px] flex items-center justify-center transition-colors shrink-0",
                      isEditing
                        ? "text-muted-foreground hover:bg-muted"
                        : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    )}
                  >
                    {isEditing ? <X size={14} /> : <Pencil size={13} />}
                  </button>
                </div>

                {/* Editor */}
                {isEditing && (
                  <div className="px-2.5 pb-3 pt-1 space-y-2.5 border-t border-line-soft">
                    <div className="flex flex-wrap gap-1.5 pt-2.5">
                      {WORKOUT_ORDER.map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraftType(t)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors",
                            draftType === t
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-muted-foreground border-border hover:text-foreground"
                          )}
                        >
                          {WORKOUT_EMOJI[t]} {WORKOUT_LABELS[t]}
                        </button>
                      ))}
                    </div>
                    <input
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      placeholder="Catatan (opsional) — mis. 'lari 5km' / 'push day'"
                      className="w-full rounded-[10px] bg-background border border-border px-3 py-2 text-[13px] outline-none focus:border-primary transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingDay(null)}
                        disabled={saving}
                        className="flex-1 h-9 rounded-[10px] border border-border text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={saveEditor}
                        disabled={saving}
                        className="flex-[2] flex items-center justify-center gap-1.5 h-9 rounded-[10px] bg-primary text-primary-foreground text-[12px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
                      >
                        <Check size={14} /> {saving ? "Menyimpan..." : "Simpan"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Referensi rencana ===== */}
      <div className="flex items-center gap-2 pt-1 px-1">
        <Dumbbell size={16} className="text-primary" />
        <h2 className="font-heading font-bold tracking-tight text-[15px]">Panduan latihan</h2>
      </div>

      {/* Full Body routine */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <div>
          <p className="font-heading font-bold tracking-tight text-[15px]">💪 Full Body · 3×/minggu</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            ~30–40 menit per sesi. Frekuensi 3× lebih worth daripada split pas volume terbatas.
          </p>
        </div>
        <div className="divide-y divide-line-soft">
          {FULL_BODY.map((r) => (
            <div key={r.cat} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{r.cat}</p>
                <p className="text-[13px] font-semibold truncate">{r.move}</p>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-primary shrink-0">{r.sr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pull-up progression */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <p className="font-heading font-bold tracking-tight text-[15px]">Progresi Pull-up</p>
        </div>
        <p className="text-[12px] text-muted-foreground -mt-1">
          Belum bisa full? Naik bertahap. Makin turun berat badan, makin enteng pull-up-nya.
        </p>
        <div className="space-y-2">
          {PULLUP_STEPS.map((s, i) => (
            <div
              key={s.step}
              className={cn(
                "flex items-start gap-3 rounded-[12px] border px-3 py-2.5",
                s.star ? "border-primary/40 bg-accent/30" : "border-border bg-background"
              )}
            >
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">
                  {s.step} {s.star && <span className="text-primary">⭐ paling cepat</span>}
                </p>
                <p className="text-[12px] text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">Chin-up</span> (telapak ngadep lo) lebih gampang, kena
          biceps → mulai sini. <span className="font-semibold text-foreground">Pull-up</span> (ngadep depan) lebih
          susah, fokus lats. Nanti campur.
        </p>
      </div>

      {/* Progressive overload */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Repeat size={16} className="text-primary" />
          <p className="font-heading font-bold tracking-tight text-[15px]">Progressive Overload</p>
        </div>
        <p className="text-[12px] text-muted-foreground -mt-1">
          Bodyweight — naikin kesulitan lewat urutan ini (bukan langsung nambah beban):
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {OVERLOAD_CHAIN.map((step, i) => (
            <div key={step} className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-accent text-primary text-[12px] font-semibold">{step}</span>
              {i < OVERLOAD_CHAIN.length - 1 && <span className="text-muted-foreground text-[12px]">→</span>}
            </div>
          ))}
        </div>
        <div className="rounded-[12px] bg-accent/40 border border-primary/25 px-3.5 py-2.5">
          <p className="text-[13px] font-semibold">
            Aturan simpel: tiap minggu SELALU ada 1 hal yang naik.
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Catat reps tiap sesi biar keliatan progresnya.</p>
        </div>
      </div>

      {/* Squat snacks + kardio */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-[22px] border border-border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-primary" />
            <p className="font-heading font-bold tracking-tight text-[14px]">Squat Snacks · tiap hari</p>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Tiap ~45 menit duduk: 10–15 squat santai. Bukan pengganti latihan — booster gula darah + NEAT.
            Tujuannya <span className="font-semibold text-foreground">gerak</span>, bukan ngos-ngosan.
          </p>
        </div>
        <div className="rounded-[22px] border border-border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Footprints size={16} className="text-primary" />
            <p className="font-heading font-bold tracking-tight text-[14px]">Kardio · opsional</p>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Nggak wajib. Kalau mau nambah bakaran: jalan cepat / naik-turun tangga 20–30 menit di hari istirahat.
            Cukup.
          </p>
        </div>
      </div>
    </div>
  );
}
