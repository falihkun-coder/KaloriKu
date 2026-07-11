# This is NOT the Next.js you know

This version (Next 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Project rules

- Semua rumus domain (kalori, macro, streak, summary) HARUS pure functions di `src/lib/calculations.ts` — dipakai bareng web, bot, dan cron biar angka konsisten di semua surface.
- Mutasi data: tulis Firestore → patch state Zustand lokal (optimistic). Jangan full re-fetch.
- Firebase project `personal-hub-d9f2f` DIBAGI dengan Manga Tracker & SF6 Combo Builder. Firestore rules harus selalu mempertahankan akses koleksi `mangas`, `characters`, `combos`. Hosting pakai target `kaloriku` (site `kaloriku-d9f2f`).
- Deploy: `npm run build` dulu, lalu `firebase deploy --only hosting:kaloriku`. Verifikasi di https://kaloriku-d9f2f.web.app setelah deploy.
- Desain: token di `globals.css` (krem + aksen terakota `#DC6B2A`, switchable via `data-accent`). Angka besar pakai `font-heading` + `tabular-nums`. Radius kartu 22–26px. Bahasa UI: Indonesia santai.
