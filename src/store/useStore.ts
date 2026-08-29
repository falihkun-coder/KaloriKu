import { create } from "zustand";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import {
  FoodEntry,
  Goals,
  WeightLog,
  WaterLog,
  SavedMeal,
  ExerciseEntry,
  WorkoutSchedule,
  ScheduleDay,
  DayKey,
  MealType,
  MealPlan,
  PlannedMeal,
  DEFAULT_GOALS,
  DEFAULT_WORKOUT_SCHEDULE,
  EMPTY_MEAL_PLAN,
  dateKeyWIB,
  mealLabel,
  guessMealCategory,
} from "@/lib/calculations";

export type AiUsageStats = {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
};

export type Playlist = {
  id: string;
  userId?: string;
  name: string;
  /** ID YouTube — playlist id (PL...) atau video id, sesuai `kind` */
  playlistId: string;
  /** default "playlist" biar kompatibel sama data lama */
  kind?: "playlist" | "video";
  createdAt: string;
};

export type UserProfile = {
  name?: string;
  email?: string;
  telegramChatId?: number;
  discordUserId?: string;
  tz?: string;
};

interface AppState {
  userId: string | null;
  entries: FoodEntry[];
  goals: Goals;
  weights: WeightLog[];
  waterLogs: WaterLog[];
  meals: SavedMeal[];
  exercises: ExerciseEntry[];
  playlists: Playlist[];
  schedule: WorkoutSchedule;
  mealPlan: MealPlan;
  aiUsage: AiUsageStats;
  profile: UserProfile;
  isLoading: boolean;

  // UI: dialog tambah/edit makan bisa dibuka dari sidebar, FAB, empty state,
  // dan hasil scan AI (draft tanpa id → mode tambah dengan prefill)
  foodDialogOpen: boolean;
  editingEntry: Partial<FoodEntry> | null;
  openFoodDialog: (entry?: Partial<FoodEntry>) => void;
  closeFoodDialog: () => void;

  // UI: dialog catat/edit olahraga (draft tanpa id → tambah dengan prefill)
  exerciseDialogOpen: boolean;
  editingExercise: Partial<ExerciseEntry> | null;
  openExerciseDialog: (ex?: Partial<ExerciseEntry>) => void;
  closeExerciseDialog: () => void;

  fetchData: (userId?: string) => Promise<void>;
  addEntry: (entry: Omit<FoodEntry, "id">) => Promise<void>;
  updateEntry: (id: string, entry: Partial<Omit<FoodEntry, "id">>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  updateGoals: (goals: Partial<Goals>) => Promise<void>;
  addWeight: (w: Omit<WeightLog, "id">) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;
  addExercise: (ex: Omit<ExerciseEntry, "id">) => Promise<void>;
  updateExercise: (id: string, ex: Partial<Omit<ExerciseEntry, "id">>) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  addPlaylist: (p: Omit<Playlist, "id">) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  /** Set aktivitas 1 hari di jadwal olahraga mingguan (persist per-user). */
  setScheduleDay: (day: DayKey, data: ScheduleDay) => Promise<void>;
  /** Simpan seluruh rencana makan mingguan (hasil generate AI). */
  saveMealPlan: (days: MealPlan["days"]) => Promise<void>;
  /** Set/hapus 1 slot makan di rencana (null = kosongin). */
  setPlanSlot: (day: DayKey, meal: MealType, planned: PlannedMeal | null) => Promise<void>;
  /** Tambah air minum hari ini (ml). */
  addWater: (ml: number) => Promise<void>;
  /** Simpan makanan ke library favorit (skip kalau nama sudah ada). */
  addMeal: (meal: Omit<SavedMeal, "id" | "useCount">) => Promise<void>;
  /** Edit favorit yang udah tersimpan (nama, resto, kategori, kalori, makro). */
  updateMeal: (id: string, patch: Partial<Omit<SavedMeal, "id" | "userId">>) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  /** 1-tap log: catat favorit sebagai entri makan sekarang. */
  logMeal: (meal: SavedMeal) => Promise<void>;
  /** Bikin kode sekali-pakai buat link akun Telegram, return kodenya. */
  createTelegramLink: () => Promise<string>;
  /** Bikin kode sekali-pakai buat link akun Discord, return kodenya. */
  createDiscordLink: () => Promise<string>;
}

// Entries selalu urut terbaru dulu, konsisten dengan fetchData.
const sortByCreatedDesc = (entries: FoodEntry[]) =>
  [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const useStore = create<AppState>((set, get) => ({
  userId: null,
  entries: [],
  goals: DEFAULT_GOALS,
  weights: [],
  waterLogs: [],
  meals: [],
  exercises: [],
  playlists: [],
  schedule: DEFAULT_WORKOUT_SCHEDULE,
  mealPlan: EMPTY_MEAL_PLAN,
  aiUsage: { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0 },
  profile: {},
  isLoading: false,

  foodDialogOpen: false,
  editingEntry: null,
  openFoodDialog: (entry) => set({ foodDialogOpen: true, editingEntry: entry ?? null }),
  closeFoodDialog: () => set({ foodDialogOpen: false, editingEntry: null }),

  exerciseDialogOpen: false,
  editingExercise: null,
  openExerciseDialog: (ex) => set({ exerciseDialogOpen: true, editingExercise: ex ?? null }),
  closeExerciseDialog: () => set({ exerciseDialogOpen: false, editingExercise: null }),

  fetchData: async (uid?: string) => {
    const currentUid = uid || get().userId;
    if (!currentUid) return;

    set({ isLoading: true, userId: currentUid });
    try {
      const entryQuery = query(collection(db, "foodEntries"), where("userId", "==", currentUid));
      const weightQuery = query(collection(db, "weights"), where("userId", "==", currentUid));
      const waterQuery = query(collection(db, "waterLogs"), where("userId", "==", currentUid));
      const mealQuery = query(collection(db, "meals"), where("userId", "==", currentUid));
      const exerciseQuery = query(collection(db, "exercises"), where("userId", "==", currentUid));
      const playlistQuery = query(collection(db, "playlists"), where("userId", "==", currentUid));
      const goalsDocRef = doc(db, "goals", currentUid);
      const userDocRef = doc(db, "users", currentUid);
      const aiUsageDocRef = doc(db, "aiUsage", currentUid);
      const scheduleDocRef = doc(db, "workoutSchedule", currentUid);
      const mealPlanDocRef = doc(db, "mealPlans", currentUid);

      const [
        entrySnapshot,
        weightSnapshot,
        waterSnapshot,
        mealSnapshot,
        exerciseSnapshot,
        playlistSnapshot,
        goalsDocSnap,
        userDocSnap,
        aiUsageDocSnap,
        scheduleDocSnap,
        mealPlanDocSnap,
      ] = await Promise.all([
        getDocs(entryQuery),
        getDocs(weightQuery),
        getDocs(waterQuery),
        getDocs(mealQuery),
        getDocs(exerciseQuery),
        getDocs(playlistQuery),
        getDoc(goalsDocRef),
        getDoc(userDocRef),
        getDoc(aiUsageDocRef),
        getDoc(scheduleDocRef),
        getDoc(mealPlanDocRef),
      ]);

      const entries = sortByCreatedDesc(
        entrySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as FoodEntry[]
      );

      const weights = (weightSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as WeightLog[]).sort(
        (a, b) => (a.date < b.date ? -1 : 1)
      );

      const waterLogs = waterSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as WaterLog[];

      const meals = (mealSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SavedMeal[]).sort(
        (a, b) => (b.useCount || 0) - (a.useCount || 0)
      );

      const exercises = (exerciseSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ExerciseEntry[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const playlists = (playlistSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Playlist[]).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      let goals: Goals = { ...DEFAULT_GOALS, userId: currentUid };
      if (goalsDocSnap.exists()) {
        goals = { ...goals, ...(goalsDocSnap.data() as Goals) };
      } else {
        await setDoc(goalsDocRef, goals);
      }

      // users/{uid} — dipakai bot Telegram buat nyari user dari chatId
      const seed: UserProfile = {
        name: auth.currentUser?.displayName || "",
        email: auth.currentUser?.email || "",
        tz: "Asia/Jakarta",
      };
      let profile: UserProfile = seed;
      if (userDocSnap.exists()) {
        profile = { ...seed, ...(userDocSnap.data() as UserProfile) };
      }
      await setDoc(userDocRef, profile, { merge: true });

      const aiUsage: AiUsageStats = aiUsageDocSnap.exists()
        ? {
            totalRequests: (aiUsageDocSnap.data().totalRequests as number) || 0,
            totalInputTokens: (aiUsageDocSnap.data().totalInputTokens as number) || 0,
            totalOutputTokens: (aiUsageDocSnap.data().totalOutputTokens as number) || 0,
          }
        : { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0 };

      // Jadwal olahraga: merge default (biar hari yang belum diisi tetap ada) dgn data user
      let schedule: WorkoutSchedule = { ...DEFAULT_WORKOUT_SCHEDULE, userId: currentUid };
      if (scheduleDocSnap.exists()) {
        const saved = scheduleDocSnap.data() as WorkoutSchedule;
        schedule = { userId: currentUid, days: { ...DEFAULT_WORKOUT_SCHEDULE.days, ...(saved.days || {}) } };
      }

      // Rencana makan: merge sama struktur kosong biar semua hari selalu ada
      let mealPlan: MealPlan = { ...EMPTY_MEAL_PLAN, userId: currentUid };
      if (mealPlanDocSnap.exists()) {
        const saved = mealPlanDocSnap.data() as MealPlan;
        mealPlan = {
          userId: currentUid,
          updatedAt: saved.updatedAt,
          days: { ...EMPTY_MEAL_PLAN.days, ...(saved.days || {}) },
        };
      }

      set({
        entries,
        weights,
        waterLogs,
        meals,
        exercises,
        playlists,
        schedule,
        mealPlan,
        aiUsage,
        goals,
        profile,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      set({ isLoading: false });
    }
  },

  addEntry: async (entry) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");

      const newEntry = { ...entry, userId: state.userId };
      const docRef = await addDoc(collection(db, "foodEntries"), newEntry);
      set({ entries: sortByCreatedDesc([{ id: docRef.id, ...newEntry } as FoodEntry, ...state.entries]) });
    } catch (error) {
      console.error("Error adding entry:", error);
      throw error;
    }
  },

  updateEntry: async (id, updated) => {
    try {
      const state = get();
      await updateDoc(doc(db, "foodEntries", id), updated);
      set({
        entries: sortByCreatedDesc(
          state.entries.map((e) => (e.id === id ? { ...e, ...updated, id } : e))
        ),
      });
    } catch (error) {
      console.error("Error updating entry:", error);
      throw error;
    }
  },

  deleteEntry: async (id) => {
    try {
      const state = get();
      await deleteDoc(doc(db, "foodEntries", id));
      set({ entries: state.entries.filter((e) => e.id !== id) });
    } catch (error) {
      console.error("Error deleting entry:", error);
      throw error;
    }
  },

  updateGoals: async (goals) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");

      const newGoals = { ...state.goals, ...goals, userId: state.userId };
      await setDoc(doc(db, "goals", state.userId), newGoals);
      set({ goals: newGoals });
    } catch (error) {
      console.error("Error updating goals:", error);
      throw error;
    }
  },

  addWeight: async (w) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");

      const newWeight = { ...w, userId: state.userId };
      const docRef = await addDoc(collection(db, "weights"), newWeight);
      const weights = [...state.weights, { id: docRef.id, ...newWeight } as WeightLog].sort((a, b) =>
        a.date < b.date ? -1 : 1
      );
      set({ weights });
    } catch (error) {
      console.error("Error adding weight:", error);
      throw error;
    }
  },

  deleteWeight: async (id) => {
    try {
      const state = get();
      await deleteDoc(doc(db, "weights", id));
      set({ weights: state.weights.filter((w) => w.id !== id) });
    } catch (error) {
      console.error("Error deleting weight:", error);
      throw error;
    }
  },

  addExercise: async (ex) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");
      const newEx = { ...ex, userId: state.userId };
      const docRef = await addDoc(collection(db, "exercises"), newEx);
      const exercises = [{ id: docRef.id, ...newEx } as ExerciseEntry, ...state.exercises].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      set({ exercises });
    } catch (error) {
      console.error("Error adding exercise:", error);
      throw error;
    }
  },

  updateExercise: async (id, ex) => {
    try {
      const state = get();
      await updateDoc(doc(db, "exercises", id), ex);
      const exercises = state.exercises
        .map((e) => (e.id === id ? { ...e, ...ex, id } : e))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      set({ exercises });
    } catch (error) {
      console.error("Error updating exercise:", error);
      throw error;
    }
  },

  deleteExercise: async (id) => {
    try {
      const state = get();
      await deleteDoc(doc(db, "exercises", id));
      set({ exercises: state.exercises.filter((e) => e.id !== id) });
    } catch (error) {
      console.error("Error deleting exercise:", error);
      throw error;
    }
  },

  addPlaylist: async (p) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");
      const newP = { ...p, userId: state.userId };
      const docRef = await addDoc(collection(db, "playlists"), newP);
      set({ playlists: [...state.playlists, { id: docRef.id, ...newP } as Playlist] });
    } catch (error) {
      console.error("Error adding playlist:", error);
      throw error;
    }
  },

  deletePlaylist: async (id) => {
    try {
      const state = get();
      await deleteDoc(doc(db, "playlists", id));
      set({ playlists: state.playlists.filter((p) => p.id !== id) });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      throw error;
    }
  },

  setScheduleDay: async (day, data) => {
    const state = get();
    if (!state.userId) throw new Error("User not authenticated");
    const prev = state.schedule;
    // buang note undefined biar Firestore gak nolak
    const clean: ScheduleDay = data.note?.trim() ? { type: data.type, note: data.note.trim() } : { type: data.type };
    const next: WorkoutSchedule = { userId: state.userId, days: { ...prev.days, [day]: clean } };
    set({ schedule: next }); // optimistic
    try {
      await setDoc(doc(db, "workoutSchedule", state.userId), next);
    } catch (error) {
      console.error("Error saving schedule:", error);
      set({ schedule: prev });
      throw error;
    }
  },

  saveMealPlan: async (days) => {
    const state = get();
    if (!state.userId) throw new Error("User not authenticated");
    const prev = state.mealPlan;
    const next: MealPlan = { userId: state.userId, days, updatedAt: new Date().toISOString() };
    set({ mealPlan: next }); // optimistic
    try {
      await setDoc(doc(db, "mealPlans", state.userId), next);
    } catch (error) {
      console.error("Error saving meal plan:", error);
      set({ mealPlan: prev });
      throw error;
    }
  },

  setPlanSlot: async (day, meal, planned) => {
    const state = get();
    if (!state.userId) throw new Error("User not authenticated");
    const prev = state.mealPlan;
    const dayPlan = { ...(prev.days[day] || {}) };
    if (planned) dayPlan[meal] = planned;
    else delete dayPlan[meal];
    const next: MealPlan = {
      userId: state.userId,
      updatedAt: new Date().toISOString(),
      days: { ...prev.days, [day]: dayPlan },
    };
    set({ mealPlan: next }); // optimistic
    try {
      await setDoc(doc(db, "mealPlans", state.userId), next);
    } catch (error) {
      console.error("Error saving plan slot:", error);
      set({ mealPlan: prev });
      throw error;
    }
  },

  addWater: async (ml) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");

      const newLog = { userId: state.userId, ml, date: dateKeyWIB() };
      const docRef = await addDoc(collection(db, "waterLogs"), newLog);
      set({ waterLogs: [...state.waterLogs, { id: docRef.id, ...newLog } as WaterLog] });
    } catch (error) {
      console.error("Error adding water:", error);
      throw error;
    }
  },

  addMeal: async (meal) => {
    try {
      const state = get();
      if (!state.userId) throw new Error("User not authenticated");

      const exists = state.meals.some(
        (m) => mealLabel(m).trim().toLowerCase() === mealLabel(meal).trim().toLowerCase()
      );
      if (exists) return;

      const newMeal = {
        ...meal,
        category: meal.category ?? guessMealCategory(meal.name),
        userId: state.userId,
        useCount: 0,
      };
      const docRef = await addDoc(collection(db, "meals"), newMeal);
      set({ meals: [...state.meals, { id: docRef.id, ...newMeal } as SavedMeal] });
    } catch (error) {
      console.error("Error adding meal:", error);
      throw error;
    }
  },

  updateMeal: async (id, patch) => {
    const state = get();
    const prev = state.meals.find((m) => m.id === id);
    if (!prev) return;
    // Optimistic — langsung update UI, rollback kalau Firestore gagal
    set({ meals: state.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
    try {
      await updateDoc(doc(db, "meals", id), patch);
    } catch (error) {
      console.error("Error updating meal:", error);
      set({ meals: get().meals.map((m) => (m.id === id ? prev : m)) });
      throw error;
    }
  },

  deleteMeal: async (id) => {
    try {
      const state = get();
      await deleteDoc(doc(db, "meals", id));
      set({ meals: state.meals.filter((m) => m.id !== id) });
    } catch (error) {
      console.error("Error deleting meal:", error);
      throw error;
    }
  },

  logMeal: async (meal) => {
    const state = get();
    await state.addEntry({
      name: mealLabel(meal),
      kcal: meal.kcal,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      portion: meal.portion || "1 porsi",
      meal: (() => {
        const hour = Number(
          new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
        );
        if (hour < 11) return "sarapan" as const;
        if (hour < 15) return "siang" as const;
        if (hour < 18) return "snack" as const;
        if (hour < 22) return "malam" as const;
        return "snack" as const;
      })(),
      source: "manual",
      ...(meal.items && meal.items.length > 0 && { items: meal.items }),
      createdAt: new Date().toISOString(),
    });
    // useCount buat urutan chips favorit — gagal pun gak masalah
    try {
      const newCount = (meal.useCount || 0) + 1;
      await updateDoc(doc(db, "meals", meal.id), { useCount: newCount });
      set({
        meals: [...get().meals.map((m) => (m.id === meal.id ? { ...m, useCount: newCount } : m))].sort(
          (a, b) => (b.useCount || 0) - (a.useCount || 0)
        ),
      });
    } catch {
      /* ignore */
    }
  },

  createTelegramLink: async () => {
    const uid = get().userId;
    if (!uid) throw new Error("User not authenticated");
    return createLinkCode("telegramLinks", uid);
  },

  createDiscordLink: async () => {
    const uid = get().userId;
    if (!uid) throw new Error("User not authenticated");
    return createLinkCode("discordLinks", uid);
  },
}));

// Kode sekali-pakai (15 menit) untuk link akun bot — dipakai Telegram & Discord.
async function createLinkCode(collectionName: string, uid: string): Promise<string> {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31])
    .join("");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await setDoc(doc(db, collectionName, code), { uid, expiresAt });
  return code;
}
