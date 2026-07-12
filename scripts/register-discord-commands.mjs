// Daftarkan slash command KaloriKu ke Discord (global).
// Jalankan sekali setelah bikin app: `node scripts/register-discord-commands.mjs`
// Butuh DISCORD_APPLICATION_ID + DISCORD_BOT_TOKEN di .env.local.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local secara manual (tanpa dependency)
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* fallback ke process.env */
  }
}
loadEnv();

const APP_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error("❌ DISCORD_APPLICATION_ID / DISCORD_BOT_TOKEN belum diisi di .env.local");
  process.exit(1);
}

const STRING = 3;
const INTEGER = 4;
const ATTACHMENT = 11;

const commands = [
  {
    name: "link",
    description: "Hubungkan akun Discord ke KaloriKu",
    options: [{ name: "kode", description: "Kode dari web (Goals & Setting)", type: STRING, required: true }],
  },
  {
    name: "catat",
    description: "Catat makan lewat teks",
    options: [{ name: "makanan", description: "Contoh: nasi goreng porsi sedang", type: STRING, required: true }],
  },
  {
    name: "scan",
    description: "Catat makan dari foto makanan / label nutrisi",
    options: [{ name: "foto", description: "Foto makanan atau label nutrisi", type: ATTACHMENT, required: true }],
  },
  {
    name: "olahraga",
    description: "Catat olahraga (AI estimasi kalori terbakar)",
    options: [{ name: "deskripsi", description: "Contoh: lari 5km 30 menit", type: STRING, required: true }],
  },
  { name: "today", description: "Ringkasan kalori hari ini" },
  {
    name: "muat",
    description: "Cek muat gak di target hari ini",
    options: [{ name: "makanan", description: "Contoh: martabak manis 2 potong", type: STRING, required: true }],
  },
  { name: "saran", description: "AI saranin menu dari sisa kalori" },
  {
    name: "air",
    description: "Catat air minum (ml)",
    options: [{ name: "ml", description: "Jumlah ml, mis. 500", type: INTEGER, required: true }],
  },
];

const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
  body: JSON.stringify(commands),
});

if (res.ok) {
  const data = await res.json();
  console.log(`✅ ${data.length} command terdaftar:`, data.map((c) => "/" + c.name).join(" "));
} else {
  console.error(`❌ Gagal (${res.status}):`, await res.text());
  process.exit(1);
}
