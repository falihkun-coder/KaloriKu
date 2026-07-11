# KaloriKu 🔥

Personal calorie tracker AI-first — log makan lewat chat/foto ke bot (nanti) atau lewat web; dashboard sisa kalori, riwayat, goals. Reuse penuh arsitektur Spending Tracker (lihat `PROJECT_BLUEPRINT.md` di project Spending Tracker).

**Live:** https://kaloriku-d9f2f.web.app
**Firebase project:** `personal-hub-d9f2f` (nebeng bareng Manga Tracker & SF6 Combo Builder — kuota project GCP habis)

## Stack

Next.js 16 (App Router) + React 19 + TS · Tailwind v4 + shadcn/base-ui · Zustand (optimistic) · Firebase Firestore + Auth · Recharts · Firebase Hosting (multi-site, site: `kaloriku-d9f2f`)

## Development

```bash
npm install
npm run dev
```

Env di `.env.local` / `.env.production` (config web app "KaloriKu" di project personal-hub).

## Deploy

```bash
npm run build          # verifikasi build dulu
firebase deploy --only hosting:kaloriku
```

> ⚠️ `firebase use` global bisa nunjuk project lain — selalu pastikan active project `personal-hub-d9f2f` (sudah dipin via `firebase use` di folder ini). Rules Firestore project ini DIBAGI dengan Manga Tracker & SF6: jangan deploy rules tanpa mempertahankan koleksi `mangas`, `characters`, `combos`.

## Struktur

```
src/app/           dashboard (/), login, riwayat, goals
src/components/    layout (sidebar 248px, bottom-nav + FAB) · dashboard · food (row, dialog) · ui (shadcn)
src/lib/           firebase.ts · calculations.ts (SEMUA rumus domain, pure functions)
src/store/         useStore.ts (Zustand + Firestore CRUD optimistic + state dialog)
```

## Data model (Firestore, shared dengan app lain di personal-hub)

- `foodEntries/{id}` — userId, name, kcal, protein_g, carbs_g, fat_g, portion, meal, source, createdAt
- `goals/{uid}` — kcalTarget, proteinTarget, carbsTarget, fatTarget, weightTarget, activityLevel
- `weights/{id}` — userId, kg, date (dipakai P1 Berat & Tren)

Daily reset 00.00 WIB — semua per-hari dihitung via `dateKeyWIB()` di `calculations.ts`.

## Roadmap (brief §10)

- [x] S0–S1 · P0: auth (Google), CRUD entry, goals, dashboard, riwayat
- [x] S2: AI extract (scan + chat via Gemini), Telegram bot @KaloriKubot + link akun, simulator
- [x] S3: berat & tren, water log, cron summary harian 21.00 & mingguan Minggu 19.00 WIB → DM
- [ ] P2 (backlog): Discord bot, meal library, AI meal suggestion, barcode, recipe calc, export, adaptive goal, voice log
