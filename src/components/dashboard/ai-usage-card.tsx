"use client";

import { Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { estimateCostIdr, fmtIdr, USD_TO_IDR } from "@/lib/ai-pricing";
import { fmtNum } from "@/lib/calculations";

export function AiUsageCard() {
  const usage = useStore((state) => state.aiUsage);

  const totalCost = estimateCostIdr(usage.totalInputTokens, usage.totalOutputTokens);
  const perRequest = usage.totalRequests > 0 ? totalCost / usage.totalRequests : 0;

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
          <Sparkles size={17} />
        </div>
        <div>
          <p className="font-heading font-bold tracking-tight text-[15px]">Pemakaian AI</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Estimasi biaya Gemini dari akunmu di KaloriKu.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Total request AI</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">{fmtNum(usage.totalRequests)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Estimasi total biaya</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">{fmtIdr(totalCost)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Rata-rata / request</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-xl mt-0.5">{fmtIdr(perRequest)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Token (masuk / keluar)</p>
          <p className="font-heading font-bold tabular-nums tracking-tight text-[15px] mt-1.5">
            {fmtNum(usage.totalInputTokens)} <span className="text-muted-foreground">/</span> {fmtNum(usage.totalOutputTokens)}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        ⚠️ Estimasi kasar pakai tarif <span className="font-mono">gemini-2.5-flash</span> (kurs $1≈Rp{fmtNum(USD_TO_IDR)}).
        Angka pastinya cek Google Cloud Billing — Google punya porsi gratis & diskon cache. Cuma ngitung pemakaian
        dari KaloriKu (API key-nya dibagi sama Spending Tracker).
      </p>
    </div>
  );
}
