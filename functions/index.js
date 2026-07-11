const { onSchedule } = require("firebase-functions/v2/scheduler");

const APP_URL = "https://kaloriku-d9f2f.web.app";

// Panggil endpoint cron di app (SSR function) dengan header secret.
async function callCron(path) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
  });
  const body = await res.text();
  console.log(`${path} -> ${res.status} ${body}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
}

// Ringkasan harian 21.00 WIB (brief §09)
exports.dailySummary = onSchedule(
  { schedule: "0 21 * * *", timeZone: "Asia/Jakarta", region: "us-central1" },
  () => callCron("/api/cron/daily-summary")
);

// Ringkasan mingguan Minggu 19.00 WIB (brief §09)
exports.weeklySummary = onSchedule(
  { schedule: "0 19 * * 0", timeZone: "Asia/Jakarta", region: "us-central1" },
  () => callCron("/api/cron/weekly-summary")
);
