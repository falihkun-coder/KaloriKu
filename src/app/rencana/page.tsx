"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Sparkles,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  ChevronDown,
  Utensils,
  Pencil,
  ThumbsDown,
  X,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { auth } from "@/lib/firebase";
import {
  DayKey,
  MealType,
  PlannedMeal,
  MealPlan,
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  MEAL_ORDER,
  MEAL_LABELS,
  dayPlanTotals,
  planHasContent,
  todayDayKey,
  currentMealWIB,
  fmtNum,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MEAL_EMOJI: Record<MealType, string> = {
  sarapan: "🌅",
  siang: "☀️",
  malam: "🌙",
  snack: "🍪",
};

/** Draft edit 1 slot — angka disimpan sebagai string biar input enak diketik */
type SlotEdit = {
  day: DayKey;
  meal: MealType;
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  portion: string;
};

export default function RencanaPage() {
  const mealPlan = useStore((s) => s.mealPlan);
  const goals = useStore((s) => s.goals);
  const meals = useStore((s) => s.meals);
  const saveMealPlan = useStore((s) => s.saveMealPlan);
  const setPlanSlot = useStore((s) => s.setPlanSlot);
  const setDislikes = useStore((s) => s.setDislikes);
  const addEntry = useStore((s) => s.addEntry);
  const openFoodDialog = useStore((s) => s.openFoodDialog);

  const today = todayDayKey();
  const hasPlan = planHasContent(mealPlan);
  const dislikes = mealPlan.dislikes || [];

  const [prefs, setPrefs] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<DayKey>(today);

  // Edit 1 slot manual
  const [edit, setEdit] = useState<SlotEdit | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal "gak suka" — user boleh persingkat jadi kata kunci (mis. "jengkol")
  const [dislikeDraft, setDislikeDraft] = useState<{ day: DayKey; meal: MealType; text: string } | null>(null);
  const [savingDislike, setSavingDislike] = useState(false);
  const [newDislike, setNewDislike] = useState("");

  const generateWeek = async () => {
    if (hasPlan && !window.confirm("Ganti seluruh rencana minggu ini dengan yang baru?")) return;
    setGenerating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ preferences: prefs.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`plan failed: ${res.status}`);
      const { days } = (await res.json()) as { days: MealPlan["days"] };
      await saveMealPlan(days);
      setOpenDay(today);
      toast.success("Rencana seminggu jadi! 🗓️");
    } catch (e) {
      console.error(e);
      toast.error("Gagal bikin rencana — coba lagi");
    } finally {
      setGenerating(false);
    }
  };

  // Ganti 1 slot pakai AI (tetep hormatin menu lain di hari yang sama)
  const rerollSlot = async (day: DayKey, meal: MealType) => {
    const key = `${day}-${meal}`;
    setBusySlot(key);
    try {
      const dayPlan = mealPlan.days[day] || {};
      const others = MEAL_ORDER.filter((m) => m !== meal && dayPlan[m]).map((m) => ({
        meal: m,
        name: dayPlan[m]!.name,
        kcal: dayPlan[m]!.kcal,
      }));
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          mode: "slot",
          day,
          meal,
          avoid: dayPlan[meal]?.name,
          otherMealsToday: others,
          preferences: prefs.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`slot failed: ${res.status}`);
      const { planned } = (await res.json()) as { planned: PlannedMeal | null };
      if (!planned) throw new Error("empty slot");
      await setPlanSlot(day, meal, planned);
      toast.success(`Diganti: ${planned.name}`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal ganti menu");
    } finally {
      setBusySlot(null);
    }
  };

  // 1-tap: catat menu rencana jadi entri makan hari ini
  const logPlanned = async (meal: MealType, p: PlannedMeal) => {
    const key = `log-${meal}-${p.name}`;
    setBusySlot(key);
    try {
      await addEntry({
        name: p.name,
        kcal: p.kcal,
        protein_g: p.protein_g,
        carbs_g: p.carbs_g,
        fat_g: p.fat_g,
        portion: p.portion || "1 porsi",
        meal,
        source: "manual",
        createdAt: new Date().toISOString(),
      });
      toast.success(`${p.name} tercatat! 🍽️`);
    } catch {
      toast.error("Gagal catat");
    } finally {
      setBusySlot(null);
    }
  };

  const clearSlot = async (day: DayKey, meal: MealType) => {
    try {
      await setPlanSlot(day, meal, null);
    } catch {
      toast.error("Gagal hapus");
    }
  };

  // Isi slot manual dari meal library
  const fillFromLibrary = async (day: DayKey, meal: MealType, mealId: string) => {
    const m = meals.find((x) => x.id === mealId);
    if (!m) return;
    try {
      await setPlanSlot(day, meal, {
        name: m.restaurant ? `${m.name} (${m.restaurant})` : m.name,
        kcal: m.kcal,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
        portion: m.portion || "1 porsi",
        mealId: m.id,
      });
      toast.success("Rencana diupdate");
    } catch {
      toast.error("Gagal simpan");
    }
  };

  // ===== Edit slot manual =====
  const openSlotEdit = (day: DayKey, meal: MealType, p?: PlannedMeal) => {
    setEdit({
      day,
      meal,
      name: p?.name || "",
      kcal: p ? String(p.kcal) : "",
      protein: p ? String(p.protein_g) : "",
      carbs: p ? String(p.carbs_g) : "",
      fat: p ? String(p.fat_g) : "",
      portion: p?.portion || "1 porsi",
    });
  };

  const saveSlotEdit = async () => {
    if (!edit) return;
    if (!edit.name.trim()) {
      toast.error("Nama menunya diisi dulu ya");
      return;
    }
    setSavingEdit(true);
    try {
      const prev = mealPlan.days[edit.day]?.[edit.meal];
      await setPlanSlot(edit.day, edit.meal, {
        name: edit.name.trim(),
        kcal: Number(edit.kcal) || 0,
        protein_g: Number(edit.protein) || 0,
        carbs_g: Number(edit.carbs) || 0,
        fat_g: Number(edit.fat) || 0,
        portion: edit.portion.trim() || "1 porsi",
        // alasan AI lama gak relevan lagi kalau menunya diganti manual
        ...(prev?.reason && prev.name === edit.name.trim() ? { reason: prev.reason } : {}),
      });
      toast.success("Menu diperbarui ✏️");
      setEdit(null);
    } catch {
      toast.error("Gagal simpan perubahan");
    } finally {
      setSavingEdit(false);
    }
  };

  // ===== Blacklist "gak suka" =====
  const confirmDislike = async () => {
    if (!dislikeDraft) return;
    const text = dislikeDraft.text.trim();
    if (!text) {
      toast.error("Tulis dulu apa yang gak kamu suka");
      return;
    }
    setSavingDislike(true);
    try {
      await setDislikes([...dislikes, text]);
      const { day, meal } = dislikeDraft;
      setDislikeDraft(null);
      toast.success(`"${text}" gak bakal muncul lagi 🚫`);
      await rerollSlot(day, meal); // langsung cariin gantinya
    } catch {
      toast.error("Gagal simpan");
    } finally {
      setSavingDislike(false);
    }
  };

  const removeDislike = async (name: string) => {
    try {
      await setDislikes(dislikes.filter((d) => d !== name));
    } catch {
      toast.error("Gagal hapus");
    }
  };

  const addDislikeManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = newDislike.trim();
    if (!v) return;
    try {
      await setDislikes([...dislikes, v]);
      setNewDislike("");
    } catch {
      toast.error("Gagal simpan");
    }
  };

  const todayPlan = mealPlan.days[today] || {};
  const todayTotals = dayPlanTotals(todayPlan);
  const nowMeal = currentMealWIB();
  const nextUp = todayPlan[nowMeal];

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Rencana Makan"
        description="Menu seminggu udah dipilihin — biar gak bingung tiap hari."
        icon={CalendarCheck}
      />

      {/* Fokus: menu berikutnya hari ini */}
      {hasPlan && (
        <div className="relative overflow-hidden rounded-[22px] bg-primary text-primary-foreground p-5 md:p-6">
          <div aria-hidden className="absolute -top-12 -right-8 w-44 h-44 rounded-full bg-white/10" />
          <div className="relative">
            <p className="text-[12px] font-semibold text-white/80 uppercase tracking-wide">
              {WEEKDAY_LABELS[today]} · {MEAL_LABELS[nowMeal]}
            </p>
            {nextUp ? (
              <>
                <p className="font-heading font-bold tracking-tight text-[clamp(19px,3.6vw,24px)] leading-tight mt-1">
                  {nextUp.name}
                </p>
                <p className="text-[13px] text-white/85 mt-1">
                  {fmtNum(nextUp.kcal)} kkal · P {fmtNum(nextUp.protein_g)} · K {fmtNum(nextUp.carbs_g)} · L{" "}
                  {fmtNum(nextUp.fat_g)} g · {nextUp.portion}
                </p>
                {nextUp.reason && <p className="text-[12px] text-white/70 mt-1.5">💡 {nextUp.reason}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => logPlanned(nowMeal, nextUp)}
                    disabled={busySlot === `log-${nowMeal}-${nextUp.name}`}
                    className="flex items-center gap-1.5 px-4 h-10 rounded-[11px] bg-white text-primary text-[13px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60"
                  >
                    <Plus size={15} /> Catat ini
                  </button>
                  <button
                    onClick={() => rerollSlot(today, nowMeal)}
                    disabled={busySlot === `${today}-${nowMeal}`}
                    className="flex items-center gap-1.5 px-3.5 h-10 rounded-[11px] bg-white/15 hover:bg-white/25 text-[13px] font-semibold transition-colors disabled:opacity-60"
                  >
                    {busySlot === `${today}-${nowMeal}` ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    Ganti
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/85 mt-1.5">Slot ini belum ada rencananya — scroll ke bawah buat isi.</p>
            )}
            <p className="text-[12px] text-white/70 mt-3">
              Total rencana hari ini: {fmtNum(todayTotals.kcal)} / {fmtNum(goals.kcalTarget)} kkal · protein{" "}
              {fmtNum(todayTotals.protein_g)} / {fmtNum(goals.proteinTarget)} g
            </p>
          </div>
        </div>
      )}

      {/* Generator */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
            <Sparkles size={17} />
          </div>
          <div>
            <p className="font-heading font-bold tracking-tight text-[15px]">
              {hasPlan ? "Bikin ulang rencana" : "Bikin rencana seminggu"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              AI susun 7 hari dari favorit kamu, pas sama {fmtNum(goals.kcalTarget)} kkal & {fmtNum(goals.proteinTarget)} g
              protein.
            </p>
          </div>
        </div>

        <textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={2}
          placeholder="Preferensi (opsional) — mis. sarapan simpel, gak suka seafood, budget hemat, sering makan di luar pas weekend"
          className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none"
        />

        <button
          onClick={generateWeek}
          disabled={generating}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? "AI lagi nyusun menu..." : hasPlan ? "Generate ulang seminggu" : "Generate rencana seminggu"}
        </button>

        {meals.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Tip: isi <span className="font-semibold text-foreground">Meal Library</span> dulu biar rencananya pakai
            makanan yang emang kamu suka.
          </p>
        )}
      </div>

      {/* Blacklist makanan */}
      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
            <Ban size={17} />
          </div>
          <div>
            <p className="font-heading font-bold tracking-tight text-[15px]">Gak disukai</p>
            <p className="text-[12px] text-muted-foreground">
              Yang di sini gak bakal muncul lagi tiap generate — termasuk menu yang mengandungnya.
            </p>
          </div>
        </div>

        {dislikes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {dislikes.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-[12px] font-semibold bg-destructive/10 text-destructive border border-destructive/25"
              >
                {d}
                <button
                  onClick={() => removeDislike(d)}
                  aria-label={`Hapus ${d} dari daftar gak disukai`}
                  className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-destructive/20 transition-colors"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Belum ada. Tap <span className="font-semibold text-foreground">👎 Gak suka</span> di menu manapun, atau
            tambahin sendiri di bawah.
          </p>
        )}

        <form onSubmit={addDislikeManual} className="flex gap-2">
          <input
            value={newDislike}
            onChange={(e) => setNewDislike(e.target.value)}
            placeholder="Tambah — mis. jengkol, seafood, pete"
            className="flex-1 min-w-0 rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            className="px-4 rounded-[12px] border border-border text-[13px] font-semibold text-foreground hover:border-primary/40 transition-colors shrink-0"
          >
            Tambah
          </button>
        </form>
      </div>

      {/* Rencana per hari */}
      {!hasPlan ? (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <Utensils size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada rencana</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[320px]">
            Generate sekali, dipakai seminggu. Tiap hari tinggal liat & tap catat — gak perlu mikir lagi mau makan apa.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {WEEKDAY_ORDER.map((day) => {
            const dayPlan = mealPlan.days[day] || {};
            const totals = dayPlanTotals(dayPlan);
            const isToday = day === today;
            const isOpen = openDay === day;
            const overTarget = totals.kcal > goals.kcalTarget + 100;

            return (
              <div
                key={day}
                className={cn(
                  "rounded-[18px] border overflow-hidden transition-colors",
                  isToday ? "border-primary/40 bg-accent/25" : "border-border bg-card"
                )}
              >
                <button
                  onClick={() => setOpenDay(isOpen ? ("" as DayKey) : day)}
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-bold", isToday && "text-primary")}>
                      {WEEKDAY_LABELS[day]}
                      {isToday && <span className="text-[10px] font-semibold uppercase ml-2">Hari ini</span>}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                      {MEAL_ORDER.filter((m) => dayPlan[m])
                        .map((m) => dayPlan[m]!.name)
                        .join(" · ") || "Belum diisi"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-[13px] font-bold tabular-nums", overTarget && "text-destructive")}>
                      {fmtNum(totals.kcal)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">P {fmtNum(totals.protein_g)} g</p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn("text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2 border-t border-line-soft pt-3">
                    {MEAL_ORDER.map((meal) => {
                      const p = dayPlan[meal];
                      const slotKey = `${day}-${meal}`;
                      const logKey = `log-${meal}-${p?.name}`;
                      return (
                        <div key={meal} className="rounded-[12px] border border-border bg-background p-3">
                          <div className="flex items-start gap-2.5">
                            <span className="text-[16px] shrink-0 mt-0.5">{MEAL_EMOJI[meal]}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                {MEAL_LABELS[meal]}
                              </p>
                              {p ? (
                                <>
                                  <p className="text-[13px] font-bold truncate">{p.name}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {fmtNum(p.kcal)} kkal · P {fmtNum(p.protein_g)} · K {fmtNum(p.carbs_g)} · L{" "}
                                    {fmtNum(p.fat_g)} g · {p.portion}
                                  </p>
                                  {p.reason && <p className="text-[11px] text-muted-foreground/80 mt-1">💡 {p.reason}</p>}
                                </>
                              ) : (
                                <p className="text-[12px] text-muted-foreground italic mt-0.5">Kosong</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            {p && isToday && (
                              <button
                                onClick={() => logPlanned(meal, p)}
                                disabled={busySlot === logKey}
                                className="flex items-center gap-1 px-3 h-8 rounded-[9px] bg-primary text-primary-foreground text-[11px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60"
                              >
                                <Plus size={12} /> Catat
                              </button>
                            )}
                            <button
                              onClick={() => rerollSlot(day, meal)}
                              disabled={busySlot === slotKey}
                              className="flex items-center gap-1 px-3 h-8 rounded-[9px] border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
                            >
                              {busySlot === slotKey ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              {p ? "Ganti" : "Isiin AI"}
                            </button>

                            <button
                              onClick={() => openSlotEdit(day, meal, p)}
                              className="flex items-center gap-1 px-3 h-8 rounded-[9px] border border-border text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                            >
                              <Pencil size={12} /> Edit
                            </button>

                            {p && (
                              <button
                                onClick={() => setDislikeDraft({ day, meal, text: p.name })}
                                title="Gak suka — jangan munculin lagi"
                                className="flex items-center gap-1 px-3 h-8 rounded-[9px] border border-border text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                              >
                                <ThumbsDown size={12} /> Gak suka
                              </button>
                            )}

                            {meals.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => e.target.value && fillFromLibrary(day, meal, e.target.value)}
                                className="h-8 rounded-[9px] border border-border bg-card text-[11px] font-semibold text-muted-foreground px-2 outline-none focus:border-primary transition-colors max-w-[150px]"
                              >
                                <option value="">Dari favorit…</option>
                                {meals.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.restaurant ? `${m.name} (${m.restaurant})` : m.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {p && (
                              <>
                                {isToday && (
                                  <button
                                    onClick={() =>
                                      openFoodDialog({
                                        name: p.name,
                                        kcal: p.kcal,
                                        protein_g: p.protein_g,
                                        carbs_g: p.carbs_g,
                                        fat_g: p.fat_g,
                                        portion: p.portion,
                                        meal,
                                        source: "manual",
                                      })
                                    }
                                    className="px-3 h-8 rounded-[9px] border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    Edit & catat
                                  </button>
                                )}
                                <button
                                  onClick={() => clearSlot(day, meal)}
                                  aria-label={`Hapus ${MEAL_LABELS[meal]} ${WEEKDAY_LABELS[day]}`}
                                  className="h-8 w-8 rounded-[9px] border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors ml-auto"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-muted-foreground px-1">
        Rencana ini pola mingguan — kepake terus tiap minggu sampai kamu generate ulang. Angka gizinya estimasi, bisa
        dikoreksi pas nyatet.
      </p>

      {/* Modal edit slot */}
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
                  <p className="font-heading font-bold tracking-tight text-[15px]">Edit menu</p>
                  <p className="text-[12px] text-muted-foreground">
                    {WEEKDAY_LABELS[edit.day]} · {MEAL_LABELS[edit.meal]}
                  </p>
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

            <label className="space-y-1 block">
              <span className="text-[11px] font-semibold text-muted-foreground">Nama menu</span>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="mis. Nasi + ayam bakar + tumis buncis"
                className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </label>

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

            {meals.length > 0 && (
              <label className="space-y-1 block">
                <span className="text-[11px] font-semibold text-muted-foreground">Atau ambil dari favorit</span>
                <select
                  value=""
                  onChange={(e) => {
                    const m = meals.find((x) => x.id === e.target.value);
                    if (!m) return;
                    setEdit({
                      ...edit,
                      name: m.restaurant ? `${m.name} (${m.restaurant})` : m.name,
                      kcal: String(m.kcal),
                      protein: String(m.protein_g),
                      carbs: String(m.carbs_g),
                      fat: String(m.fat_g),
                      portion: m.portion || "1 porsi",
                    });
                  }}
                  className="w-full rounded-[12px] bg-background border border-border px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                >
                  <option value="">Pilih favorit…</option>
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.restaurant ? `${m.name} (${m.restaurant})` : m.name} · {fmtNum(m.kcal)} kkal
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEdit(null)}
                disabled={savingEdit}
                className="flex-1 h-10 rounded-[12px] border border-border text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={saveSlotEdit}
                disabled={savingEdit}
                className="flex-[2] flex items-center justify-center gap-2 h-10 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {savingEdit ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
                {savingEdit ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal "gak suka" */}
      {dislikeDraft && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !savingDislike && setDislikeDraft(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card border border-border rounded-t-[24px] sm:rounded-[22px] p-5 md:p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[11px] bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <ThumbsDown size={16} />
              </div>
              <div>
                <p className="font-heading font-bold tracking-tight text-[15px]">Gak suka apa nih?</p>
                <p className="text-[12px] text-muted-foreground">Ini gak bakal muncul lagi di rencana berikutnya.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <input
                value={dislikeDraft.text}
                onChange={(e) => setDislikeDraft({ ...dislikeDraft, text: e.target.value })}
                className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
              <p className="text-[11px] text-muted-foreground">
                💡 Persingkat biar lebih ngefek — mis. tulis{" "}
                <span className="font-semibold text-foreground">&quot;drumstick&quot;</span> aja kalau yang gak kamu suka
                cuma ayam bagian itu, bukan seluruh menunya.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDislikeDraft(null)}
                disabled={savingDislike}
                className="flex-1 h-10 rounded-[12px] border border-border text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDislike}
                disabled={savingDislike}
                className="flex-[2] flex items-center justify-center gap-2 h-10 rounded-[12px] bg-destructive text-white text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {savingDislike ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
                {savingDislike ? "Nyimpen..." : "Blokir & ganti menu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
