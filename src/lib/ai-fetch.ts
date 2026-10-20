// Cloud Function yang ngejalanin Next.js (SSR) — dipanggil langsung, bukan lewat Firebase Hosting.
// Hosting motong request di 60 detik (gak bisa dinaikin), sementara Gemini 4 Argon bisa 1–2 menit
// (mis. rencana mingguan). Function-nya sendiri timeout 300 detik (firebase.json).
const FUNCTION_BASE = "https://us-central1-personal-hub-d9f2f.cloudfunctions.net/ssrkalorikud9f2f";
// CORS di next.config.ts cuma ngizinin origin ini.
const APP_HOST = "kaloriku-d9f2f.web.app";

/** URL buat route AI: di app live → langsung ke function; lokal / domain lain → path biasa. */
export function aiUrl(path: string): string {
  if (typeof window === "undefined" || window.location.hostname !== APP_HOST) return path;
  return `${FUNCTION_BASE}${path}`;
}
