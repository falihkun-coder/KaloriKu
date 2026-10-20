import type { NextConfig } from "next";

// Route AI dipanggil browser LANGSUNG ke Cloud Function (bukan lewat Firebase Hosting), soalnya
// Hosting motong request di 60 detik dan Gemini 4 Argon bisa lebih lama dari itu. Beda domain →
// butuh CORS. Cuma buat route AI & cuma origin app ini; route lain tetap lewat Hosting.
const APP_ORIGIN = "https://kaloriku-d9f2f.web.app";
const AI_ROUTES = "/api/:route(scan-food|scan-exercise|meal-plan|advisor|workout-alt)";

const nextConfig: NextConfig = {
  // firebase-admin default-nya external → Turbopack bikin alias symlink di
  // .next/node_modules yang gak ke-upload ke Cloud Functions. Bundle aja.
  transpilePackages: ["firebase-admin"],
  async headers() {
    return [
      {
        source: AI_ROUTES,
        headers: [
          { key: "Access-Control-Allow-Origin", value: APP_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "600" },
        ],
      },
    ];
  },
};

export default nextConfig;
