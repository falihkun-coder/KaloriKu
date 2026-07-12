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
import { FoodEntry, Goals, WeightLog, WaterLog, SavedMeal, DEFAULT_GOALS, dateKeyWIB, mealLabel } from "@/lib/calculations";

export type UserProfile = {
  name?: string;
  email?: string;
  telegramChatId?: number;
  tz?: string;
};

interface AppState {
  userId: string | null;
  entries: FoodEntry[];
  goals: Goals;
  weights: WeightLog[];
  waterLogs: WaterLog[];
  meals: SavedMeal[];
  profile: UserProfile;
  isLoading: boolean;

  // UI: dialog tambah/edit makan bisa dibuka dari sidebar, FAB, empty state,
  // dan hasil scan AI (draft tanpa id → mode tambah dengan prefill)
  foodDialogOpen: boolean;
  editingEntry: Partial<FoodEntry> | null;
  openFoodDialog: (entry?: Partial<FoodEntry>) => void;
  closeFoodDialog: () => void;

  fetchData: (userId?: string) => Promise<void>;
  addEntry: (entry: Omit<FoodEntry, "id">) => Promise<void>;
  updateEntry: (id: string, entry: Partial<Omit<FoodEntry, "id">>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  updateGoals: (goals: Partial<Goals>) => Promise<void>;
  addWeight: (w: Omit<WeightLog, "id">) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;
  /** Tambah air minum hari ini (ml). */
  addWater: (ml: number) => Promise<void>;
  /** Simpan makanan ke library favorit (skip kalau nama sudah ada). */
  addMeal: (meal: Omit<SavedMeal, "id" | "useCount">) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  /** 1-tap log: catat favorit sebagai entri makan sekarang. */
  logMeal: (meal: SavedMeal) => Promise<void>;
  /** Bikin kode sekali-pakai buat link akun Telegram, return kodenya. */
  createTelegramLink: () => Promise<string>;
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
  profile: {},
  isLoading: false,

  foodDialogOpen: false,
  editingEntry: null,
  openFoodDialog: (entry) => set({ foodDialogOpen: true, editingEntry: entry ?? null }),
  closeFoodDialog: () => set({ foodDialogOpen: false, editingEntry: null }),

  fetchData: async (uid?: string) => {
    const currentUid = uid || get().userId;
    if (!currentUid) return;

    set({ isLoading: true, userId: currentUid });
    try {
      const entryQuery = query(collection(db, "foodEntries"), where("userId", "==", currentUid));
      const weightQuery = query(collection(db, "weights"), where("userId", "==", currentUid));
      const waterQuery = query(collection(db, "waterLogs"), where("userId", "==", currentUid));
      const mealQuery = query(collection(db, "meals"), where("userId", "==", currentUid));
      const goalsDocRef = doc(db, "goals", currentUid);
      const userDocRef = doc(db, "users", currentUid);

      const [entrySnapshot, weightSnapshot, waterSnapshot, mealSnapshot, goalsDocSnap, userDocSnap] =
        await Promise.all([
          getDocs(entryQuery),
          getDocs(weightQuery),
          getDocs(waterQuery),
          getDocs(mealQuery),
          getDoc(goalsDocRef),
          getDoc(userDocRef),
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

      set({ entries, weights, waterLogs, meals, goals, profile, isLoading: false });
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

      const newMeal = { ...meal, userId: state.userId, useCount: 0 };
      const docRef = await addDoc(collection(db, "meals"), newMeal);
      set({ meals: [...state.meals, { id: docRef.id, ...newMeal } as SavedMeal] });
    } catch (error) {
      console.error("Error adding meal:", error);
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
    const state = get();
    if (!state.userId) throw new Error("User not authenticated");

    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31])
      .join("");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await setDoc(doc(db, "telegramLinks", code), { uid: state.userId, expiresAt });
    return code;
  },
}));
