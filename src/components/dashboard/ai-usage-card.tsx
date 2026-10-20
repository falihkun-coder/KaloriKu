"use client";

import { Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  AI_MODEL,
  LEGACY_MODEL,
  GROUNDING_FREE_PER_MONTH,
  USD_TO_IDR,
  costUsd,
  rateFor,
  nextRateChange,
  monthKey,
  fmtIdr,
} from "@/lib/ai-pricing";
import { fmtNum } from "@/lib/calculations";

const MODEL_LABEL: Record<string, string> = {
  "gemini-4-argon": "Gemini 4 Argon",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
};

function fmtDate(isoDay: string) {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AiUsageCard() {
  const usage = useStore((state) => state.aiUsage);

  // Biaya persis (dicatat per request) + estimasi buat data lama yang belum punya catatan biaya.
  const legacyIn = Math.max(0, usage.totalInputTokens - usage.costedInputTokens);
  const legacyOut = Math.max(0, usage.totalOutputTokens - usage.costedOutputTokens);
  const legacyUsd = costUsd({ model: LEGACY_MODEL, inputTokens: legacyIn, outputTokens: legacyOut });
  const hasLegacy = legacyIn + legacyOut > 0;

  const totalIdr = (usage.totalCostUsd + legacyUsd) * USD_TO_IDR;
  const perRequest = usage.totalRequests > 0 ? totalIdr / usage.totalRequests : 0;

  const rate = rateFor(AI_MODEL);
  const upcoming = nextRateChange(AI_MODEL);
  const groundedThisMonth = usage.groundedByMonth[monthKey()] || 0;

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
          <Sparkles size={17} />
        </div>
        <div>
          <p className="font-heading font-bold tracking-tight text-[15px]">Pemakaian AI</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Model: <span className="font-semibold text-foreground">{MODEL_LABEL[AI_MODEL] || AI_MODEL}</span> · $
            {rate.inputUsd} masuk / ${rate.outputUsd} keluar per 1 juta token
          </p>
        </div>
      </div>

      {upcoming && (
        <p className="rounded-[12px] border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[12px] text-foreground">
          ⚠️ Tarif {MODEL_LABEL[AI_MODEL] || AI_MODEL} naik mulai{" "}
          <span className="font-semibold">{fmtDate(upcoming.from)}</span>: ${upcoming.inputUsd} / ${upcoming.outputUsd}{" "}
          per 1 juta token ({Math.round(upcoming.outputUsd / rate.outputUsd)}x lipat).
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Total request AI</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">{fmtNum(usage.totalRequests)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Total biaya</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">{fmtIdr(totalIdr)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Rata-rata / request</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">{fmtIdr(perRequest)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Cari Google (bulan ini)</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">
            {fmtNum(groundedThisMonth)}
            <span className="text-[12px] font-semibold text-muted-foreground"> / {fmtNum(GROUNDING_FREE_PER_MONTH)} gratis</span>
          </p>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        Token: {fmtNum(usage.totalInputTokens)} masuk · {fmtNum(usage.totalOutputTokens)} keluar
        {usage.totalThinkingTokens > 0 && <> (termasuk {fmtNum(usage.totalThinkingTokens)} buat "mikir")</>}
      </p>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Biaya dicatat per request pakai tarif yang berlaku saat itu (kurs $1≈Rp{fmtNum(USD_TO_IDR)}).
        {hasLegacy && (
          <>
            {" "}
            Termasuk perkiraan ~{fmtIdr(legacyUsd * USD_TO_IDR)} buat request lama sebelum pencatatan ini — yang itu
            cuma batas bawah karena token "mikir"-nya dulu belum kecatat.
          </>
        )}{" "}
        Angka pastinya tetap di Google Cloud Billing. Cuma ngitung pemakaian dari KaloriKu (API key-nya dibagi sama
        Spending Tracker).
      </p>
    </div>
  );
}
