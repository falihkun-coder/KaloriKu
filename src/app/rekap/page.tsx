"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  BarChart,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { ChartColumnBig, Target, Flame, Dumbbell, CalendarCheck, Utensils, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import {
  MealType,
  dailyStats,
  adherenceStats,
  byDayOfWeek,
  mealTimeSplit,
  topFoods,
  exerciseSplit,
  WEEKDAY_SHORT,
  fmtNum,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

type Period = 7 | 30 | 90;

const PERIODS: { id: Period; label: string }[] = [
  { id: 7, label: "7 hari" },
  { id: 30, label: "30 hari" },
  { id: 90, label: "90 hari" },
];

const MEAL_COLOR: Record<MealType, string> = {
  sarapan: "var(--meal-sarapan)",
  siang: "var(--meal-siang)",
  malam: "var(--meal-malam)",
  snack: "var(--meal-snack)",
};

function dayShort(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

/** Kartu statistik kecil */
function StatTile({
  icon: Icon,
  color,
  label,
  value,
  unit,
  sub,
}: {
  icon: typeof Target;
  color: string;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-card p-4">
      <div
        className="h-9 w-9 rounded-[11px] flex items-center justify-center mb-3"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon size={17} />
      </div>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
        {value}
        {unit && <span className="text-[13px] font-semibold text-muted-foreground ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

/** Baris bar horizontal buat distribusi */
function BarRow({
  label,
  value,
  unit,
  pct,
  color,
  sub,
}: {
  label: string;
  value: number;
  unit: string;
  pct: number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-[13px] font-semibold truncate">{label}</p>
        <p className="text-[12px] font-bold tabular-nums shrink-0">
          {fmtNum(value)} <span className="text-[10px] font-semibold text-muted-foreground">{unit}</span>
        </p>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(2, pct))}%`, backgroundColor: color }}
        />
      </div>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function RekapPage() {
  const entries = useStore((s) => s.entries);
  const exercises = useStore((s) => s.exercises);
  const goals = useStore((s) => s.goals);

  const [period, setPeriod] = useState<Period>(30);

  const stats = useMemo(() => dailyStats(entries, exercises, period), [entries, exercises, period]);
  const adherence = useMemo(() => adherenceStats(stats, goals.kcalTarget), [stats, goals.kcalTarget]);
  const dow = useMemo(() => byDayOfWeek(stats), [stats]);
  const mealSplit = useMemo(() => mealTimeSplit(entries, period), [entries, period]);
  const foods = useMemo(() => topFoods(entries, period, 8), [entries, period]);
  const exSplit = useMemo(() => exerciseSplit(exercises, period), [exercises, period]);

  const hasData = adherence.daysLogged > 0;

  // Chart utama: masuk (bar) + net (garis)
  const series = stats.map((s) => ({
    ...s,
    label: dayShort(s.date),
    over: s.kcal > goals.kcalTarget,
  }));

  const maxDow = Math.max(...dow.map((d) => d.avgKcal), 1);
  const maxFood = Math.max(...foods.map((f) => f.count), 1);
  const maxEx = Math.max(...exSplit.map((e) => e.kcal), 1);
  const mealTotal = mealSplit.reduce((s, m) => s + m.kcal, 0);

  // Heatmap: kolom = minggu, baris = Sen–Min
  const heatCols = useMemo(() => {
    const cols: (typeof stats)[] = [];
    let cur: typeof stats = [];
    for (const s of stats) {
      const wd = new Date(`${s.date}T12:00:00+07:00`).getDay(); // 0=Min
      const isMonday = wd === 1;
      if (isMonday && cur.length > 0) {
        cols.push(cur);
        cur = [];
      }
      cur.push(s);
    }
    if (cur.length) cols.push(cur);
    return cols;
  }, [stats]);

  const heatColor = (s: (typeof stats)[number]) => {
    if (!s.logged) return { backgroundColor: "var(--muted)" };
    if (s.kcal > goals.kcalTarget) return { backgroundColor: "var(--destructive)", opacity: 0.85 };
    const ratio = goals.kcalTarget > 0 ? s.kcal / goals.kcalTarget : 0;
    return { backgroundColor: "var(--primary)", opacity: Math.max(0.3, Math.min(1, ratio)) };
  };

  const onTargetPct = adherence.daysLogged > 0 ? Math.round((adherence.daysOnTarget / adherence.daysLogged) * 100) : 0;

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Rekap"
        description="Gambar besar dari semua catatanmu — pola, konsistensi, kebiasaan."
        icon={ChartColumnBig}
      />

      {/* Periode */}
      <div className="flex p-1 bg-muted rounded-[12px] w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              "px-4 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors",
              period === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <ChartColumnBig size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada data di periode ini</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[300px]">
            Catat makan beberapa hari dulu — nanti pola & statistiknya muncul di sini.
          </p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatTile
              icon={Flame}
              color="var(--primary)"
              label="Rata-rata masuk"
              value={fmtNum(adherence.avgKcal)}
              unit="kkal"
              sub={`target ${fmtNum(goals.kcalTarget)} · selisih ${adherence.avgKcal - goals.kcalTarget > 0 ? "+" : ""}${fmtNum(adherence.avgKcal - goals.kcalTarget)}`}
            />
            <StatTile
              icon={Target}
              color="var(--positive)"
              label="Protein rata-rata"
              value={fmtNum(adherence.avgProtein)}
              unit="g"
              sub={`target ${fmtNum(goals.proteinTarget)} g · ${Math.round((adherence.avgProtein / (goals.proteinTarget || 1)) * 100)}% tercapai`}
            />
            <StatTile
              icon={CalendarCheck}
              color="var(--streak)"
              label="Hari kena target"
              value={`${adherence.daysOnTarget}/${adherence.daysLogged}`}
              sub={`${onTargetPct}% dari hari yang dicatat`}
            />
            <StatTile
              icon={Dumbbell}
              color="var(--destructive)"
              label="Rata-rata terbakar"
              value={fmtNum(adherence.avgBurned)}
              unit="kkal"
              sub={`net rata-rata ${fmtNum(adherence.avgNet)} kkal`}
            />
          </div>

          {/* Kalori masuk vs net */}
          <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
            <p className="font-heading font-bold tracking-tight text-[15px]">Kalori masuk & net</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 mb-3">
              Batang = makanan (merah kalau lewat target) · garis = net setelah olahraga · putus-putus = target{" "}
              {fmtNum(goals.kcalTarget)} kkal
            </p>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={period === 7 ? 0 : period === 30 ? 4 : 13}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v, name) => [`${fmtNum(Number(v))} kkal`, name === "kcal" ? "Masuk" : "Net"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine y={goals.kcalTarget} stroke="var(--muted-foreground)" strokeDasharray="6 4" strokeWidth={1.5} />
                  <Bar dataKey="kcal" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                    {series.map((d) => (
                      <Cell
                        key={d.date}
                        fill={d.over ? "var(--destructive)" : "var(--primary)"}
                        fillOpacity={d.kcal === 0 ? 0.12 : 0.85}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="var(--positive)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Heatmap konsistensi */}
          <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
            <p className="font-heading font-bold tracking-tight text-[15px]">Konsistensi logging</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 mb-4">
              {adherence.daysLogged} dari {adherence.daysTotal} hari tercatat · makin pekat makin banyak kalorinya
            </p>

            <div className="overflow-x-auto">
              <div className="flex gap-1 min-w-fit">
                {/* Label hari */}
                <div className="flex flex-col gap-1 pr-1 shrink-0">
                  {(["sen", "sel", "rab", "kam", "jum", "sab", "min"] as const).map((d) => (
                    <div key={d} className="h-[14px] flex items-center">
                      <span className="text-[9px] text-muted-foreground leading-none">{WEEKDAY_SHORT[d][0]}</span>
                    </div>
                  ))}
                </div>
                {heatCols.map((col, ci) => {
                  // Susun kolom jadi 7 slot Sen–Min
                  const slots: (typeof stats[number] | null)[] = Array(7).fill(null);
                  for (const s of col) {
                    const wd = new Date(`${s.date}T12:00:00+07:00`).getDay(); // 0=Min
                    const idx = wd === 0 ? 6 : wd - 1; // Sen=0 … Min=6
                    slots[idx] = s;
                  }
                  return (
                    <div key={ci} className="flex flex-col gap-1 shrink-0">
                      {slots.map((s, ri) => (
                        <div
                          key={ri}
                          title={s ? `${dayShort(s.date)} · ${fmtNum(s.kcal)} kkal` : ""}
                          className="h-[14px] w-[14px] rounded-[3px]"
                          style={s ? heatColor(s) : { backgroundColor: "transparent" }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: "var(--muted)" }} /> kosong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: "var(--primary)", opacity: 0.4 }} />
                <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: "var(--primary)" }} /> di bawah target
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: "var(--destructive)" }} /> lewat target
              </span>
            </div>
          </div>

          {/* Pola per hari + distribusi waktu makan */}
          <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
            <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
              <p className="font-heading font-bold tracking-tight text-[15px]">Pola per hari</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 mb-3">
                Rata-rata kalori tiap hari — keliatan hari apa yang sering bocor
              </p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dow.map((d) => ({ ...d, label: WEEKDAY_SHORT[d.day] }))}
                    margin={{ top: 8, right: 8, bottom: 0, left: -14 }}
                  >
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v) => [`${fmtNum(Number(v))} kkal`, "Rata-rata"]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine y={goals.kcalTarget} stroke="var(--muted-foreground)" strokeDasharray="6 4" strokeWidth={1.5} />
                    <Bar dataKey="avgKcal" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {dow.map((d) => (
                        <Cell
                          key={d.day}
                          fill={d.avgKcal > goals.kcalTarget ? "var(--destructive)" : "var(--primary)"}
                          fillOpacity={d.count === 0 ? 0.12 : 0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {(() => {
                  const worst = [...dow].filter((d) => d.count > 0).sort((a, b) => b.avgKcal - a.avgKcal)[0];
                  if (!worst) return "Belum cukup data.";
                  return worst.avgKcal > goals.kcalTarget
                    ? `⚠️ Paling boros: ${WEEKDAY_SHORT[worst.day]} (${fmtNum(worst.avgKcal)} kkal rata-rata)`
                    : `✅ Semua hari rata-ratanya masih di bawah target.`;
                })()}
              </p>
            </div>

            <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
              <p className="font-heading font-bold tracking-tight text-[15px]">Kalori per waktu makan</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 mb-2">
                Dari total {fmtNum(mealTotal)} kkal selama {period} hari
              </p>
              <div className="divide-y divide-line-soft">
                {mealSplit.map((m) => (
                  <BarRow
                    key={m.meal}
                    label={m.label}
                    value={m.kcal}
                    unit="kkal"
                    pct={m.pct}
                    color={MEAL_COLOR[m.meal]}
                    sub={`${m.pct}% dari total`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Top makanan */}
          <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
                <Utensils size={17} />
              </div>
              <div>
                <p className="font-heading font-bold tracking-tight text-[15px]">Makanan paling sering</p>
                <p className="text-[12px] text-muted-foreground">
                  Ini &quot;menu default&quot; kamu — yang paling nentuin hasil jangka panjang
                </p>
              </div>
            </div>
            {foods.length === 0 ? (
              <p className="text-[13px] text-muted-foreground py-4">Belum ada data.</p>
            ) : (
              <div className="divide-y divide-line-soft mt-2">
                {foods.map((f) => (
                  <BarRow
                    key={f.name}
                    label={f.name}
                    value={f.count}
                    unit="x"
                    pct={(f.count / maxFood) * 100}
                    color="var(--primary)"
                    sub={`rata-rata ${fmtNum(f.avgKcal)} kkal · total ${fmtNum(f.totalKcal)} kkal`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Olahraga */}
          {exSplit.length > 0 && (
            <div className="rounded-[22px] border border-border bg-card p-5 md:p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
                  <TrendingDown size={17} />
                </div>
                <div>
                  <p className="font-heading font-bold tracking-tight text-[15px]">Olahraga per jenis</p>
                  <p className="text-[12px] text-muted-foreground">
                    Total {fmtNum(exSplit.reduce((s, e) => s + e.kcal, 0))} kkal terbakar ·{" "}
                    {exSplit.reduce((s, e) => s + e.sessions, 0)} sesi
                  </p>
                </div>
              </div>
              <div className="divide-y divide-line-soft mt-2">
                {exSplit.map((e) => (
                  <BarRow
                    key={e.type}
                    label={e.label}
                    value={e.kcal}
                    unit="kkal"
                    pct={(e.kcal / maxEx) * 100}
                    color="var(--positive)"
                    sub={`${e.sessions} sesi · ${fmtNum(e.min)} menit`}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
