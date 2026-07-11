import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin default-nya external → Turbopack bikin alias symlink di
  // .next/node_modules yang gak ke-upload ke Cloud Functions. Bundle aja.
  transpilePackages: ["firebase-admin"],
};

export default nextConfig;
