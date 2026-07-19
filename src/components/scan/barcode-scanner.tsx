"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, Loader2, ScanBarcode, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Scan barcode via kamera (ZXing, jalan di iOS Safari + Android) + fallback ketik manual.
export function BarcodeScanner({
  onDetected,
  busy,
}: {
  onDetected: (code: string) => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  // Bersihin kamera pas komponen di-unmount / pindah mode
  useEffect(() => () => stop(), []);

  const start = async () => {
    setError(null);
    setStarting(true);
    doneRef.current = false;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      setActive(true);
      // videoRef selalu ke-mount (lihat JSX) jadi aman dipakai di sini
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, _err, ctrl) => {
          if (result && !doneRef.current) {
            doneRef.current = true;
            ctrl.stop();
            controlsRef.current = null;
            setActive(false);
            onDetected(result.getText());
          }
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      console.error("barcode camera error:", e);
      setActive(false);
      setError("Gak bisa akses kamera — cek izin kamera di browser, atau ketik barcode-nya manual di bawah.");
    } finally {
      setStarting(false);
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manual.replace(/\D/g, "");
    if (code.length < 8) {
      setError("Barcode minimal 8 angka ya.");
      return;
    }
    setError(null);
    onDetected(code);
  };

  return (
    <div className="space-y-4">
      {/* Viewport kamera */}
      <div className="relative rounded-[16px] overflow-hidden bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn("w-full h-full object-cover", !active && "hidden")}
        />

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <div className="h-12 w-12 rounded-[14px] bg-white/10 text-white flex items-center justify-center">
              {busy || starting ? <Loader2 size={22} className="animate-spin" /> : <ScanBarcode size={22} />}
            </div>
            <p className="text-sm font-semibold text-white">
              {starting ? "Nyalain kamera..." : busy ? "Nyari produk..." : "Scan barcode kemasan"}
            </p>
            <p className="text-[12px] text-white/60">Arahin kamera ke barcode di bungkusnya</p>
          </div>
        )}

        {/* Reticle pas scanning */}
        {active && (
          <>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[70%] h-[34%] border-2 border-white/80 rounded-[12px] shadow-[0_0_0_2000px_rgba(0,0,0,0.35)]" />
            </div>
            <button
              onClick={stop}
              className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
              aria-label="Stop kamera"
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>

      {!active ? (
        <button
          onClick={start}
          disabled={starting || busy}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {starting ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
          {starting ? "Membuka kamera..." : "Nyalain kamera"}
        </button>
      ) : (
        <button
          onClick={stop}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-[12px] border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={17} /> Stop
        </button>
      )}

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      {/* Fallback ketik manual */}
      <form onSubmit={submitManual} className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="Atau ketik angka barcode-nya…"
          className="flex-1 rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-1.5 px-4 rounded-[12px] border border-border text-[13px] font-semibold text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
        >
          <Search size={15} /> Cari
        </button>
      </form>
    </div>
  );
}
