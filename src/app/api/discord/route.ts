import { NextResponse, after } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { extractFood, ExtractedFood } from "@/lib/ai-extract";
import { estimateExercise } from "@/lib/exercise-extract";
import { recordAiUsage } from "@/lib/ai-usage";
import { formatDailySummary } from "@/lib/calorie-summary";
import { simulateFit, formatFit } from "@/lib/simulate-fit";
import { suggestMeals, formatSuggestions } from "@/lib/advisor";
import {
  FoodEntry,
  ExerciseEntry,
  Goals,
  WaterLog,
  DEFAULT_GOALS,
  DEFAULT_WATER_TARGET_ML,
  MEAL_LABELS,
  MealType,
  consumedToday,
  budgetBurned,
  fmtNum,
  waterOn,
  dateKeyWIB,
} from "@/lib/calculations";

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;

const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const EPHEMERAL = 64;

type Component = { type: number; components?: Component[]; style?: number; label?: string; custom_id?: string };

// Verify Ed25519 signature (Discord requirement) — wrap raw key ke SPKI DER.
function verifySignature(rawBody: string, signature: string, timestamp: string): boolean {
  if (!DISCORD_PUBLIC_KEY || !signature || !timestamp) return false;
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(DISCORD_PUBLIC_KEY, "hex")]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function deferred() {
  return NextResponse.json({ type: 5, data: { flags: EPHEMERAL } });
}
function updateMessage(content: string, components: Component[] = []) {
  return NextResponse.json({ type: 7, data: { content, components, flags: EPHEMERAL } });
}

async function editOriginal(token: string, body: { content: string; components?: Component[] }) {
  await fetch(`https://discord.com/api/v10/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function findUserIdByDiscord(discordUserId: string): Promise<string | null> {
  const snap = await adminDb.collection("users").where("discordUserId", "==", discordUserId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function getRecentEntries(userId: string): Promise<FoodEntry[]> {
  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const snap = await adminDb
    .collection("foodEntries")
    .where("userId", "==", userId)
    .where("createdAt", ">=", since)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FoodEntry[];
}

async function getGoals(userId: string): Promise<Goals> {
  const d = await adminDb.collection("goals").doc(userId).get();
  return d.exists ? { ...DEFAULT_GOALS, ...(d.data() as Goals) } : DEFAULT_GOALS;
}

async function getRecentExercises(userId: string): Promise<ExerciseEntry[]> {
  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const snap = await adminDb
    .collection("exercises")
    .where("userId", "==", userId)
    .where("createdAt", ">=", since)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ExerciseEntry[];
}

function currentMealWIB(): MealType {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
  );
  if (hour < 11) return "sarapan";
  if (hour < 15) return "siang";
  if (hour < 18) return "snack";
  if (hour < 22) return "malam";
  return "snack";
}

function foodConfirmText(food: ExtractedFood): string {
  let msg = `🍽️ **${food.name}** (${food.portion})\n`;
  msg += `${MEAL_LABELS[food.meal]} · yakin ${Math.round(food.confidence * 100)}%\n\n`;
  msg += `🔥 ${fmtNum(food.kcal)} kkal\n`;
  if (food.items && food.items.length > 0) {
    for (const it of food.items) msg += `  • ${it.name} — ${fmtNum(it.kcal)} kkal\n`;
  }
  msg += `💪 Protein ${fmtNum(food.protein_g)} g · 🍚 Karbo ${fmtNum(food.carbs_g)} g · 🥑 Lemak ${fmtNum(food.fat_g)} g\n\n`;
  msg += `Simpan?`;
  return msg;
}

function confirmButtons(pendingId: string): Component[] {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "✅ Simpan", custom_id: `fs:${pendingId}` },
        { type: 2, style: 4, label: "❌ Batal", custom_id: `fc:${pendingId}` },
      ],
    },
  ];
}

// Parkir hasil AI di pendingEntries (custom_id cuma muat id) — wajib konfirmasi
// sebelum simpan (guardrail akurasi, brief §08).
async function createPending(userId: string, food: ExtractedFood, source: "chat" | "scan"): Promise<string> {
  await recordAiUsage(userId, food.usage);
  const ref = await adminDb.collection("pendingEntries").add({
    userId,
    source,
    food,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, timestamp)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === PING) {
    return NextResponse.json({ type: 1 });
  }

  // ===== Tombol Simpan / Batal =====
  if (interaction.type === MESSAGE_COMPONENT) {
    const customId: string = interaction.data?.custom_id || "";
    const [action, pendingId] = customId.split(":");
    try {
      if ((action === "fs" || action === "fc") && pendingId) {
        const pendingRef = adminDb.collection("pendingEntries").doc(pendingId);
        const pendingDoc = await pendingRef.get();
        if (!pendingDoc.exists) return updateMessage("⚠️ Data kadaluarsa — kirim ulang ya.");
        const pending = pendingDoc.data()!;

        if (action === "fc") {
          await pendingRef.delete();
          return updateMessage("❌ Dibatalkan. Gak jadi dicatat.");
        }

        const food = pending.food as ExtractedFood;
        await adminDb.collection("foodEntries").add({
          userId: pending.userId,
          name: food.name,
          kcal: food.kcal,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
          portion: food.portion,
          meal: food.meal,
          source: pending.source || "chat",
          confidence: food.confidence,
          ...(food.items && food.items.length > 0 && { items: food.items }),
          createdAt: new Date().toISOString(),
        });
        await pendingRef.delete();

        let msg = `✅ Tercatat: **${food.name}** — ${fmtNum(food.kcal)} kkal`;
        try {
          const [entries, goals] = await Promise.all([getRecentEntries(pending.userId), getGoals(pending.userId)]);
          const sisa = goals.kcalTarget - consumedToday(entries).kcal;
          msg += sisa >= 0 ? `\n\nSisa hari ini: ${fmtNum(sisa)} kkal` : `\n\n⚠️ Lewat target ${fmtNum(Math.abs(sisa))} kkal`;
        } catch (e) {
          console.error("remaining calc failed:", e);
        }
        return updateMessage(msg);
      }
      return updateMessage("Aksi gak dikenal.");
    } catch (e) {
      console.error("Discord component error:", e);
      return updateMessage("❌ Ada error pas nyimpen. Coba lagi ya.");
    }
  }

  // ===== Slash commands =====
  // Semua command DEFER dulu — ACK (type 5) balik instan tanpa nyentuh
  // Firestore/AI, kerjaan aslinya di after() tanpa deadline 3 dtk Discord.
  // (Cold gRPC channel firebase-admin bisa >3 dtk kalau dikerjain sinkron.)
  if (interaction.type === APPLICATION_COMMAND) {
    const name: string = interaction.data?.name;
    const discordUserId: string = interaction.member?.user?.id || interaction.user?.id;
    const opts: Record<string, unknown> = {};
    for (const o of interaction.data?.options || []) opts[o.name] = o.value;
    const token: string = interaction.token;

    after(async () => {
      try {
        // /link <kode> — hubungkan akun
        if (name === "link") {
          const code = String(opts.kode || "").trim();
          const linkRef = adminDb.collection("discordLinks").doc(code);
          const linkDoc = await linkRef.get();
          const link = linkDoc.data();
          const expired = link?.expiresAt && new Date(link.expiresAt).getTime() < Date.now();
          if (!linkDoc.exists || !link?.uid || expired) {
            await editOriginal(token, { content: "❌ Kode gak valid atau kadaluarsa. Ambil kode baru di web: Goals & Setting → Hubungkan Discord." });
            return;
          }
          await adminDb.collection("users").doc(link.uid).set({ discordUserId }, { merge: true });
          await linkRef.delete();
          await editOriginal(token, { content: "✅ Akun Discord kamu ke-link! Coba `/catat`, `/today`, `/muat`, atau `/saran`." });
          return;
        }

        const userId = await findUserIdByDiscord(discordUserId);
        if (!userId) {
          await editOriginal(token, { content: "⚠️ Discord kamu belum ke-link. Buka web KaloriKu → Goals & Setting → Hubungkan Discord, terus jalanin `/link <kode>`." });
          return;
        }

        // /today — ringkasan hari ini
        if (name === "today") {
          const [entries, goals, exercises] = await Promise.all([
            getRecentEntries(userId),
            getGoals(userId),
            getRecentExercises(userId),
          ]);
          await editOriginal(token, { content: formatDailySummary(entries, goals, dateKeyWIB(), exercises) });
          return;
        }

        // /olahraga <deskripsi> — estimasi kkal terbakar → simpan
        if (name === "olahraga") {
          const desc = String(opts.deskripsi || "").trim();
          if (!desc) {
            await editOriginal(token, { content: "💪 Format: /olahraga deskripsi:<apa + durasi>. Contoh: lari 5km 30 menit" });
            return;
          }
          const weightsSnap = await adminDb.collection("weights").where("userId", "==", userId).get();
          const weights = weightsSnap.docs.map((d) => d.data()).sort((a, b) => (a.date < b.date ? -1 : 1));
          const latestWeight = weights.length > 0 ? (weights[weights.length - 1].kg as number) : undefined;

          const ex = await estimateExercise(desc, latestWeight);
          await recordAiUsage(userId, ex.usage);
          await adminDb.collection("exercises").add({
            userId,
            name: ex.name,
            type: ex.type,
            durationMin: ex.durationMin,
            kcalBurned: ex.kcalBurned,
            source: "chat",
            createdAt: new Date().toISOString(),
          });
          const [entries, goals, exercises] = await Promise.all([
            getRecentEntries(userId),
            getGoals(userId),
            getRecentExercises(userId),
          ]);
          const burned = budgetBurned(goals, exercises);
          const sisa = goals.kcalTarget + burned - consumedToday(entries).kcal;
          let msg = `💪 Tercatat: **${ex.name}** — ${fmtNum(ex.kcalBurned)} kkal terbakar`;
          if (goals.exerciseAddsBudget !== false) {
            msg += `\n\nSisa kalori sekarang: ${fmtNum(sisa)} kkal (udah termasuk olahraga)`;
          }
          await editOriginal(token, { content: msg });
          return;
        }

        // /air <ml>
        if (name === "air") {
          const ml = Number(opts.ml) || 0;
          if (ml <= 0) {
            await editOriginal(token, { content: "💧 Isi jumlah ml yang valid, mis. /air ml:500" });
            return;
          }
          const today = dateKeyWIB();
          await adminDb.collection("waterLogs").add({ userId, ml, date: today });
          const snap = await adminDb.collection("waterLogs").where("userId", "==", userId).where("date", "==", today).get();
          const logs = snap.docs.map((d, i) => ({ id: String(i), ...d.data() })) as WaterLog[];
          const total = waterOn(logs, today);
          const goals = await getGoals(userId);
          const target = goals.waterTargetMl || DEFAULT_WATER_TARGET_ML;
          await editOriginal(token, {
            content: `💧 +${fmtNum(ml)} ml tercatat!\nHari ini: ${fmtNum(total)} / ${fmtNum(target)} ml${total >= target ? " — target tercapai! 🎉" : ""}`,
          });
          return;
        }

        // /muat <makanan> — simulator
        if (name === "muat") {
          const query = String(opts.makanan || "").trim();
          if (!query) {
            await editOriginal(token, { content: "🧮 Format: /muat makanan:<nama>. Contoh: /muat makanan:martabak 2 potong" });
            return;
          }
          const [food, entries, goals, exercises] = await Promise.all([
            extractFood({ text: query }),
            getRecentEntries(userId),
            getGoals(userId),
            getRecentExercises(userId),
          ]);
          await recordAiUsage(userId, food.usage);
          const result = simulateFit(goals, consumedToday(entries), food, budgetBurned(goals, exercises));
          await editOriginal(token, { content: formatFit(result) });
          return;
        }

        // /saran — AI saranin menu
        if (name === "saran") {
          const [entries, goals, exercises] = await Promise.all([
            getRecentEntries(userId),
            getGoals(userId),
            getRecentExercises(userId),
          ]);
          const consumed = consumedToday(entries);
          const burned = budgetBurned(goals, exercises);
          const { suggestions, usage } = await suggestMeals(goals, consumed, burned);
          await recordAiUsage(userId, usage);
          await editOriginal(token, { content: formatSuggestions(suggestions, goals.kcalTarget + burned - consumed.kcal) });
          return;
        }

        // /catat <makanan> — teks bebas → AI (atau library) → konfirmasi
        if (name === "catat") {
          const query = String(opts.makanan || "").trim();
          if (!query) {
            await editOriginal(token, { content: "Format: /catat makanan:<apa yang kamu makan>" });
            return;
          }
          // Makanan langganan? Pakai library, skip Gemini.
          const norm = query.toLowerCase();
          const mealsSnap = await adminDb.collection("meals").where("userId", "==", userId).get();
          const fav = mealsSnap.docs
            .map((d) => d.data())
            .find((m) => {
              const nm = String(m.name).trim().toLowerCase();
              const withResto = m.restaurant ? `${nm} ${String(m.restaurant).trim().toLowerCase()}` : nm;
              return nm === norm || withResto === norm;
            });
          const food: ExtractedFood = fav
            ? {
                name: fav.restaurant ? `${fav.name} (${fav.restaurant})` : fav.name,
                kcal: fav.kcal,
                protein_g: fav.protein_g,
                carbs_g: fav.carbs_g,
                fat_g: fav.fat_g,
                portion: fav.portion || "1 porsi",
                meal: currentMealWIB(),
                confidence: 1,
                ...(fav.items && fav.items.length > 0 && { items: fav.items }),
              }
            : await extractFood({ text: query });
          const pendingId = await createPending(userId, food, "chat");
          await editOriginal(token, { content: foodConfirmText(food), components: confirmButtons(pendingId) });
          return;
        }

        // /scan <foto> — foto makanan/label → AI → konfirmasi
        if (name === "scan") {
          const attId = (interaction.data?.options || []).find((o: { name: string }) => o.name === "foto")?.value;
          const attachment = interaction.data?.resolved?.attachments?.[attId];
          if (!attachment?.url) {
            await editOriginal(token, { content: "❌ Gak ada foto yang dikirim." });
            return;
          }
          const imgRes = await fetch(attachment.url);
          const base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
          const food = await extractFood({ imageBase64: base64, mimeType: attachment.content_type || "image/jpeg" });
          const pendingId = await createPending(userId, food, "scan");
          await editOriginal(token, { content: foodConfirmText(food), components: confirmButtons(pendingId) });
          return;
        }

        await editOriginal(token, { content: "Command gak dikenal." });
      } catch (e) {
        console.error("Discord command error:", e);
        await editOriginal(token, { content: "❌ Ada error pas memproses. Coba lagi ya." });
      }
    });

    return deferred();
  }

  return NextResponse.json({ type: 4, data: { content: "OK", flags: EPHEMERAL } });
}
