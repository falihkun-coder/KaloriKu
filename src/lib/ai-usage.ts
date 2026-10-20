import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { AiUsage, costUsd, monthKey } from "@/lib/ai-pricing";

// Server-only. Akumulasi pemakaian AI per user di aiUsage/{uid}.
// Biaya dihitung pas request terjadi (pakai tarif model yang berlaku saat itu), jadi tetap
// akurat walau model diganti atau harga naik. Best-effort — jangan gagalin flow utama.
export async function recordAiUsage(uid: string | undefined, usage?: AiUsage): Promise<void> {
  if (!uid || !usage) return;
  try {
    await adminDb.collection("aiUsage").doc(uid).set(
      {
        userId: uid,
        totalRequests: FieldValue.increment(1),
        totalInputTokens: FieldValue.increment(usage.inputTokens || 0),
        totalOutputTokens: FieldValue.increment(usage.outputTokens || 0),
        totalThinkingTokens: FieldValue.increment(usage.thinkingTokens || 0),
        // Token yang biayanya udah kecatat persis — sisanya (data lama) diestimasi di UI.
        costedInputTokens: FieldValue.increment(usage.inputTokens || 0),
        costedOutputTokens: FieldValue.increment(usage.outputTokens || 0),
        totalCostUsd: FieldValue.increment(costUsd(usage)),
        ...(usage.grounded && { groundedByMonth: { [monthKey()]: FieldValue.increment(1) } }),
        lastModel: usage.model,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("recordAiUsage failed:", e);
  }
}
