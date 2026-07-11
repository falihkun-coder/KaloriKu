import { initializeApp, getApps, applicationDefault, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Admin SDK dipakai API routes (webhook Telegram, scan) — Firestore rules
// strict per-user, jadi server harus bypass rules lewat admin, bukan client SDK.
// Di Cloud Functions/Run credentials otomatis dari service account default.
const adminApp: App =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
