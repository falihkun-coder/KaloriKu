import { adminDb } from "@/lib/firebase-admin";
import { FoodEntry, ExerciseEntry, Goals, WeightLog, DEFAULT_GOALS } from "@/lib/calculations";
import { formatDailySummary, formatWeeklySummary } from "@/lib/calorie-summary";

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendTelegram(chatId: number, text: string) {
  await fetch(`${TG()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

type LinkedUser = { uid: string; chatId: number };

async function getLinkedUsers(): Promise<LinkedUser[]> {
  const snap = await adminDb.collection("users").get();
  return snap.docs
    .filter((d) => d.data().telegramChatId)
    .map((d) => ({ uid: d.id, chatId: d.data().telegramChatId as number }));
}

async function getUserData(uid: string) {
  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const [entriesSnap, goalsDoc, weightsSnap, exercisesSnap] = await Promise.all([
    adminDb.collection("foodEntries").where("userId", "==", uid).where("createdAt", ">=", since).get(),
    adminDb.collection("goals").doc(uid).get(),
    adminDb.collection("weights").where("userId", "==", uid).get(),
    // fail-soft: olahraga cuma nambah budget — jangan gagalin seluruh ringkasan
    adminDb
      .collection("exercises")
      .where("userId", "==", uid)
      .where("createdAt", ">=", since)
      .get()
      .catch((e) => {
        console.error("cron: query exercises gagal, lanjut tanpa data olahraga:", e);
        return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };
      }),
  ]);
  const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FoodEntry[];
  const goals: Goals = goalsDoc.exists ? { ...DEFAULT_GOALS, ...(goalsDoc.data() as Goals) } : DEFAULT_GOALS;
  const weights = (weightsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as WeightLog[]).sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  const exercises = exercisesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as ExerciseEntry[];
  return { entries, goals, weights, exercises };
}

// Kirim ringkasan ke semua user yang link Telegram. Kegagalan 1 user jangan
// gagalin yang lain — hitung sukses/gagal buat respons cron.
async function broadcast(kind: "daily" | "weekly"): Promise<{ sent: number; failed: number }> {
  const users = await getLinkedUsers();
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    try {
      const { entries, goals, weights, exercises } = await getUserData(u.uid);
      const msg =
        kind === "daily"
          ? formatDailySummary(entries, goals, undefined, exercises)
          : formatWeeklySummary(entries, goals, weights, undefined, exercises);
      await sendTelegram(u.chatId, msg);
      sent++;
    } catch (e) {
      console.error(`Summary ${kind} failed for ${u.uid}:`, e);
      failed++;
    }
  }
  return { sent, failed };
}

export const sendDailySummaries = () => broadcast("daily");
export const sendWeeklySummaries = () => broadcast("weekly");
