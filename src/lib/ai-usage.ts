import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { AiUsage } from "@/lib/ai-pricing";

// Server-only. Akumulasi pemakaian token per user di aiUsage/{uid}.
// Best-effort — jangan pernah gagalin flow utama kalau pencatatan error.
export async function recordAiUsage(uid: string | undefined, usage?: AiUsage): Promise<void> {
  if (!uid || !usage) return;
  try {
    await adminDb.collection("aiUsage").doc(uid).set(
      {
        userId: uid,
        totalRequests: FieldValue.increment(1),
        totalInputTokens: FieldValue.increment(usage.inputTokens || 0),
        totalOutputTokens: FieldValue.increment(usage.outputTokens || 0),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("recordAiUsage failed:", e);
  }
}
