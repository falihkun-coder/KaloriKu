import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { extractFood, ExtractedFood } from "@/lib/ai-extract";
import { formatDailySummary } from "@/lib/calorie-summary";
import { simulateFit, formatFit } from "@/lib/simulate-fit";
import {
  FoodEntry,
  Goals,
  WaterLog,
  DEFAULT_GOALS,
  DEFAULT_WATER_TARGET_ML,
  MEAL_LABELS,
  consumedToday,
  fmtNum,
  shiftDateKey,
  dateKeyWIB,
  waterOn,
} from "@/lib/calculations";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

async function sendMessage(chatId: number, text: string, reply_markup?: InlineKeyboard) {
  const res = await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(reply_markup && { reply_markup }) }),
  });
  return res.json();
}

async function editMessage(chatId: number, messageId: number, text: string, reply_markup?: InlineKeyboard) {
  await fetch(`${TG}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, ...(reply_markup && { reply_markup }) }),
  });
}

async function answerCallback(cbId: string, text?: string) {
  await fetch(`${TG}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId, ...(text && { text }) }),
  });
}

// Entries user ~35 hari terakhir — cukup buat summary harian + streak.
// createdAt ISO string, jadi bisa difilter leksikografis.
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
  const doc = await adminDb.collection("goals").doc(userId).get();
  return doc.exists ? { ...DEFAULT_GOALS, ...(doc.data() as Goals) } : DEFAULT_GOALS;
}

function confidencePct(c: number) {
  return `${Math.round(c * 100)}%`;
}

function pendingConfirmText(food: ExtractedFood): string {
  let msg = `🍽️ ${food.name} (${food.portion})\n`;
  msg += `${MEAL_LABELS[food.meal]} · yakin ${confidencePct(food.confidence)}\n\n`;
  msg += `🔥 ${fmtNum(food.kcal)} kkal\n`;
  msg += `💪 Protein ${fmtNum(food.protein_g)} g · 🍚 Karbo ${fmtNum(food.carbs_g)} g · 🥑 Lemak ${fmtNum(food.fat_g)} g\n\n`;
  msg += `Simpan?`;
  return msg;
}

// Konfirmasi wajib sebelum simpan (guardrail akurasi, brief §08) — payload
// diparkir di pendingEntries karena callback_data Telegram cuma 64 byte.
async function sendConfirm(chatId: number, userId: string, food: ExtractedFood, source: "chat" | "scan", editMsgId?: number) {
  const pendingRef = await adminDb.collection("pendingEntries").add({
    userId,
    chatId,
    source,
    food,
    createdAt: new Date().toISOString(),
  });
  const keyboard: InlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Simpan", callback_data: `fs:${pendingRef.id}` },
        { text: "❌ Batal", callback_data: `fc:${pendingRef.id}` },
      ],
    ],
  };
  const text = pendingConfirmText(food) + "\n(edit detail bisa nanti di web)";
  if (editMsgId) await editMessage(chatId, editMsgId, text, keyboard);
  else await sendMessage(chatId, text, keyboard);
}

async function findUserByChatId(chatId: number) {
  const snap = await adminDb.collection("users").where("telegramChatId", "==", chatId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

export async function POST(request: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "bot not configured" }, { status: 503 });
  }
  try {
    const update = await request.json();

    // ===== Tombol Simpan / Batal =====
    if (update.callback_query) {
      const cb = update.callback_query;
      const data: string = cb.data || "";
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const [action, pendingId] = data.split(":");

      if ((action === "fs" || action === "fc") && pendingId) {
        const pendingRef = adminDb.collection("pendingEntries").doc(pendingId);
        const pendingDoc = await pendingRef.get();
        if (!pendingDoc.exists) {
          await answerCallback(cb.id, "Data kadaluarsa — kirim ulang ya.");
          return NextResponse.json({ success: true });
        }
        const pending = pendingDoc.data()!;

        if (action === "fc") {
          await pendingRef.delete();
          await editMessage(chatId, messageId, "❌ Dibatalkan. Gak jadi dicatat.");
          await answerCallback(cb.id);
          return NextResponse.json({ success: true });
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
          createdAt: new Date().toISOString(),
        });
        await pendingRef.delete();

        // Konfirmasi dulu — hitungan sisa jangan pernah blok flow utama
        let msg = `✅ Tercatat: ${food.name} — ${fmtNum(food.kcal)} kkal`;
        try {
          const [entries, goals] = await Promise.all([getRecentEntries(pending.userId), getGoals(pending.userId)]);
          const consumed = consumedToday(entries);
          const sisa = goals.kcalTarget - consumed.kcal;
          msg += `\n\n${sisa >= 0 ? `Sisa hari ini: ${fmtNum(sisa)} kkal` : `⚠️ Lewat target ${fmtNum(Math.abs(sisa))} kkal`}`;
        } catch (e) {
          console.error("Failed to compute remaining:", e);
        }
        await editMessage(chatId, messageId, msg);
        await answerCallback(cb.id, "Tersimpan!");
        return NextResponse.json({ success: true });
      }

      await answerCallback(cb.id);
      return NextResponse.json({ success: true });
    }

    if (!update.message) return NextResponse.json({ success: true });

    const message = update.message;
    const chatId: number = message.chat.id;
    const text: string | undefined = message.text;

    // ===== Link akun: /start <code> =====
    if (text && text.startsWith("/start")) {
      const code = text.split(" ")[1];
      if (code) {
        const linkRef = adminDb.collection("telegramLinks").doc(code);
        const linkDoc = await linkRef.get();
        const link = linkDoc.data();
        const expired = link?.expiresAt && new Date(link.expiresAt).getTime() < Date.now();
        if (linkDoc.exists && link?.uid && !expired) {
          await adminDb.collection("users").doc(link.uid).set({ telegramChatId: chatId }, { merge: true });
          await linkRef.delete();
          await sendMessage(
            chatId,
            "✅ Terhubung ke akun KaloriKu!\n\nSekarang tinggal:\n• Chat makananmu — \"tadi makan nasi goreng porsi sedang\"\n• Kirim foto makanan / label nutrisi\n• /today — ringkasan hari ini\n• /muat <makanan> — cek muat gak di target"
          );
        } else {
          await sendMessage(chatId, "❌ Kode gak valid atau kadaluarsa. Ambil kode baru di web: Goals & Setting → Hubungkan Telegram.");
        }
        return NextResponse.json({ success: true });
      }
      await sendMessage(chatId, "👋 Halo! Ini bot KaloriKu.\n\nHubungkan akunmu dulu: buka web KaloriKu → Goals & Setting → Hubungkan Telegram, terus klik link yang muncul.");
      return NextResponse.json({ success: true });
    }

    // ===== Semua fitur lain butuh akun ter-link =====
    const userDoc = await findUserByChatId(chatId);
    if (!userDoc) {
      await sendMessage(chatId, "⚠️ Telegram-mu belum terhubung. Buka web KaloriKu → Goals & Setting → Hubungkan Telegram.");
      return NextResponse.json({ success: true });
    }
    const userId = userDoc.id;

    // /today — ringkasan hari ini (angka sama persis dengan web via shared lib)
    if (text && /^\/(today|hariini|ringkasan)\b/i.test(text)) {
      const [entries, goals] = await Promise.all([getRecentEntries(userId), getGoals(userId)]);
      await sendMessage(chatId, formatDailySummary(entries, goals));
      return NextResponse.json({ success: true });
    }

    // /kemarin — ringkasan kemarin
    if (text && /^\/kemarin\b/i.test(text)) {
      const [entries, goals] = await Promise.all([getRecentEntries(userId), getGoals(userId)]);
      await sendMessage(chatId, formatDailySummary(entries, goals, shiftDateKey(dateKeyWIB(), -1)));
      return NextResponse.json({ success: true });
    }

    // /air <ml> — catat air minum
    if (text && /^\/air\b/i.test(text)) {
      const ml = parseInt(text.replace(/^\/air\s*/i, ""), 10);
      if (!ml || ml <= 0) {
        await sendMessage(chatId, "💧 Format: /air <ml>\nContoh: /air 500");
        return NextResponse.json({ success: true });
      }
      const today = dateKeyWIB();
      await adminDb.collection("waterLogs").add({ userId, ml, date: today });
      const snap = await adminDb.collection("waterLogs").where("userId", "==", userId).where("date", "==", today).get();
      const logs = snap.docs.map((d) => d.data()) as WaterLog[];
      const total = waterOn(logs.map((l, i) => ({ ...l, id: String(i) })), today);
      const goals = await getGoals(userId);
      const target = goals.waterTargetMl || DEFAULT_WATER_TARGET_ML;
      await sendMessage(chatId, `💧 +${fmtNum(ml)} ml tercatat!\nHari ini: ${fmtNum(total)} / ${fmtNum(target)} ml${total >= target ? " — target tercapai! 🎉" : ""}`);
      return NextResponse.json({ success: true });
    }

    // /muat <makanan> — simulator "muat gak di target?"
    if (text && /^\/(muat|sim|simulasi)\b/i.test(text)) {
      const queryText = text.replace(/^\/(muat|sim|simulasi)\s*/i, "").trim();
      if (!queryText) {
        await sendMessage(chatId, "🧮 Cek muat gak di target hari ini.\n\nFormat: /muat <makanan>\nContoh: /muat martabak manis 2 potong");
        return NextResponse.json({ success: true });
      }
      const procMsg = await sendMessage(chatId, "🧮 Ngitung...");
      try {
        const [food, entries, goals] = await Promise.all([
          extractFood({ text: queryText }),
          getRecentEntries(userId),
          getGoals(userId),
        ]);
        const result = simulateFit(goals, consumedToday(entries), food);
        await editMessage(chatId, procMsg?.result?.message_id, formatFit(result));
      } catch (e) {
        console.error("muat error:", e);
        await editMessage(chatId, procMsg?.result?.message_id, "❌ Gagal ngitung. Coba: /muat nasi padang rendang");
      }
      return NextResponse.json({ success: true });
    }

    // ===== Foto makanan / label nutrisi =====
    if (message.photo && message.photo.length > 0) {
      const procMsg = await sendMessage(chatId, "📷 Baca fotonya...");
      const procMsgId = procMsg?.result?.message_id;
      try {
        const photoId = message.photo[message.photo.length - 1].file_id;
        const fileRes = await fetch(`${TG}/getFile?file_id=${photoId}`);
        const fileData = await fileRes.json();
        if (!fileData.ok) throw new Error("getFile failed");

        const imgRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`);
        const base64Image = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

        const food = await extractFood({ imageBase64: base64Image, caption: message.caption });
        await sendConfirm(chatId, userId, food, "scan", procMsgId);
      } catch (e) {
        console.error("photo error:", e);
        await editMessage(chatId, procMsgId, "❌ Gagal baca foto. Pastiin makanannya keliatan jelas, atau ketik aja: \"nasi goreng porsi sedang\"");
      }
      return NextResponse.json({ success: true });
    }

    // ===== Teks bebas → AI extract → konfirmasi =====
    if (text) {
      const procMsg = await sendMessage(chatId, "⏳ Ngitung nutrisinya...");
      const procMsgId = procMsg?.result?.message_id;
      try {
        const food = await extractFood({ text });
        await sendConfirm(chatId, userId, food, "chat", procMsgId);
      } catch (e) {
        console.error("text error:", e);
        await editMessage(chatId, procMsgId, "❌ Gagal proses. Coba sebut makanan + porsinya, misal: \"ayam geprek + nasi, porsi sedang\"");
      }
      return NextResponse.json({ success: true });
    }

    await sendMessage(chatId, "Kirim foto makanan / label nutrisi, atau ketik apa yang barusan kamu makan. 🍜\n\n/today — ringkasan hari ini\n/muat <makanan> — cek muat gak");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
