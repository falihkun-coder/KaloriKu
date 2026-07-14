# Ngatur & deploy KaloriKu dari HP

Tujuan: bisa ubah kode + deploy ke live **tanpa buka PC** — cukup dari hp.
Caranya: project ditaruh di GitHub, dan GitHub yang otomatis deploy tiap ada
perubahan (workflow di `.github/workflows/deploy.yml`).

Setup di bawah **sekali doang**. Habis itu semua bisa dari hp.

---

## 1. Bikin token Firebase (sekali, di PC)

Di PC (folder KaloriKu), jalanin:

```
firebase login:ci
```

Bakal kebuka browser buat login → habis itu terminal ngeluarin **token panjang**
(`1//0g...`). Copy token itu — nanti dipasang sebagai secret `FIREBASE_TOKEN`.

> Alternatif lebih aman (kalau mau): pakai service account JSON + secret
> `GOOGLE_APPLICATION_CREDENTIALS`. Token CLI lebih gampang buat solo dev.

## 2. Bikin repo GitHub + push (sekali, di PC)

```
# di folder KaloriKu
gh repo create kaloriku --private --source=. --remote=origin --push
```

Kalau `gh` belum ada: bikin repo kosong manual di github.com (private), terus:

```
git remote add origin https://github.com/USERNAME/kaloriku.git
git push -u origin main
```

⚠️ **Private** ya — walaupun `.env` udah di-gitignore (rahasia aman), kode
personal lebih baik jangan publik.

## 3. Pasang GitHub Secrets

Di repo GitHub → **Settings → Secrets and variables → Actions → New repository
secret**. Tambahin ini satu-satu. **Nilainya semua ada di file `.env.local` kamu**
(atau `firebase login:ci` buat yang FIREBASE_TOKEN) — tinggal copy-paste:

```
FIREBASE_TOKEN                          (dari langkah 1)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
GEMINI_API_KEY
TELEGRAM_BOT_TOKEN
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
CRON_SECRET
DISCORD_APPLICATION_ID
DISCORD_PUBLIC_KEY
DISCORD_BOT_TOKEN
```

> Langkah 3 ini pun bisa dilakuin dari hp lewat browser/app GitHub.

## 4. Selesai — sekarang dari HP bisa:

**a. Deploy manual (paling gampang):**
Buka repo di app GitHub → tab **Actions** → workflow "Deploy KaloriKu" →
tombol **Run workflow**. Beberapa menit → live update.

**b. Edit kode dari hp:**
- App **GitHub** (edit file langsung) atau **github.dev** (ketik `.` di repo, atau
  ganti `github.com` → `github.dev` di URL — jadi VS Code di browser hp).
- Commit ke `main` → **otomatis ke-deploy** (workflow jalan sendiri).

**c. Nyuruh Claude (aku) dari hp:**
- Buka **claude.ai/code** (atau app Claude) → arahin ke repo GitHub `kaloriku`.
- Sesi jalan di cloud, clone repo, aku ubah kode + push.
- Push masuk main → GitHub Actions deploy otomatis. Nggak perlu PC.

---

## Catatan
- Deploy jalan di runner Linux GitHub — masalah Windows dulu (Developer Mode
  symlink, folder `.firebase` kekunci) **nggak muncul** di sini.
- Kalau deploy gagal, cek log di tab **Actions** repo (bisa dibaca dari hp).
- Project Firebase: `personal-hub-d9f2f`, hosting site: `kaloriku-d9f2f`.
