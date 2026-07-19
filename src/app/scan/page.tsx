"use client";

import { useRef, useState } from "react";
import { ScanLine, ImagePlus, Loader2, Sparkles, PenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { useStore } from "@/store/useStore";
import { auth } from "@/lib/firebase";
import { ExtractedFood } from "@/lib/ai-extract";
import { lookupBarcode } from "@/lib/openfoodfacts";
import { currentMealWIB } from "@/lib/calculations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "foto" | "teks" | "barcode";

export default function ScanPage() {
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const [mode, setMode] = useState<Mode>("foto");
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File-nya harus gambar ya");
      return;
    }
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleBarcode = async (code: string) => {
    setLoading(true);
    try {
      const p = await lookupBarcode(code);
      if (!p) {
        toast.error(`Barcode ${code} gak ketemu di database — isi manual aja ya`);
        openFoodDialog();
        return;
      }
      const name = p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.name} (${p.brand})` : p.name;
      openFoodDialog({
        name,
        kcal: p.kcal,
        protein_g: p.protein_g,
        carbs_g: p.carbs_g,
        fat_g: p.fat_g,
        portion: p.portion,
        meal: currentMealWIB(),
        source: "scan",
      });
      toast.success(
        p.perServing
          ? `${p.name} ketemu! Cek & simpan ya 🏷️`
          : `${p.name} ketemu — angka per 100 g, sesuaikan porsimu ya 🏷️`
      );
    } catch (e) {
      console.error(e);
      toast.error("Gagal ambil data barcode — coba lagi atau isi manual");
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (mode === "foto" && !imageBase64) {
      toast.error("Pilih foto makanan / label nutrisi dulu");
      return;
    }
    if (mode === "teks" && !text.trim()) {
      toast.error("Tulis dulu makan apa");
      return;
    }
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(
          mode === "foto"
            ? { imageBase64, mimeType, ...(caption.trim() && { caption: caption.trim() }) }
            : { text: text.trim() }
        ),
      });
      if (!res.ok) throw new Error(`scan failed: ${res.status}`);
      const { food } = (await res.json()) as { food: ExtractedFood };

      // Wajib konfirmasi/edit sebelum simpan — buka dialog dengan draft AI
      openFoodDialog({ ...food, source: mode === "foto" ? "scan" : "chat" });
    } catch (e) {
      console.error(e);
      toast.error("Gagal ekstrak — isi manual aja dulu ya");
      openFoodDialog();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Scan AI"
        description="Foto, teks, atau barcode kemasan — biar keitung otomatis."
        icon={ScanLine}
      />

      {/* Mode toggle */}
      <div className="flex p-1 bg-muted rounded-[12px] w-fit">
        {(
          [
            ["foto", "📷 Foto"],
            ["teks", "✍️ Teks"],
            ["barcode", "🏷️ Barcode"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-3.5 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors",
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-4">
        {mode === "barcode" ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[11px] bg-accent text-primary flex items-center justify-center shrink-0">
                <ScanLine size={17} />
              </div>
              <div>
                <p className="font-heading font-bold tracking-tight text-[15px]">Scan barcode kemasan</p>
                <p className="text-[12px] text-muted-foreground">
                  Nutrisi dari database Open Food Facts — gratis, tanpa AI.
                </p>
              </div>
            </div>
            <BarcodeScanner onDetected={handleBarcode} busy={loading} />
            <button
              onClick={() => openFoodDialog()}
              className="flex items-center justify-center gap-1.5 w-full text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <PenLine size={14} />
              Atau isi manual aja
            </button>
          </>
        ) : mode === "foto" ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-[16px] border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview makanan" className="w-full max-h-[320px] object-contain bg-muted" />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center">
                    <ImagePlus size={20} />
                  </div>
                  <p className="text-sm font-semibold">Pilih / jepret foto</p>
                  <p className="text-[12px] text-muted-foreground">Foto makanan atau label nutrisi kemasan</p>
                </div>
              )}
            </button>
            {preview && (
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                Ganti foto
              </button>
            )}

            {/* Konteks tambahan buat bantu AI lebih akurat */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                Konteks tambahan <span className="text-muted-foreground/70">(opsional)</span>
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder={'Contoh: "nasi ~200gr, ayam ~150gr, tanpa kulit" — biar estimasi lebih pas'}
                className="w-full rounded-[14px] bg-background border border-border px-4 py-3 text-sm outline-none focus:border-primary transition-colors resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Sebutin porsi/berat atau detail yang gak keliatan di foto — AI bakal prioritasin ini.
              </p>
            </div>
          </>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={'Contoh: "tadi makan nasi goreng porsi sedang + telur ceplok"'}
            className="w-full rounded-[14px] bg-background border border-border px-4 py-3 text-sm outline-none focus:border-primary transition-colors resize-none"
          />
        )}

        {mode !== "barcode" && (
          <>
            <button
              onClick={handleExtract}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {loading ? "AI lagi ngitung..." : "Hitung nutrisi"}
            </button>

            <button
              onClick={() => openFoodDialog()}
              className="flex items-center justify-center gap-1.5 w-full text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <PenLine size={14} />
              Atau isi manual aja
            </button>
          </>
        )}
      </div>

      <p className="text-[12px] text-muted-foreground px-1">
        {mode === "barcode"
          ? "Data dari Open Food Facts — sebelum kesimpan kamu selalu bisa koreksi angka & porsinya dulu."
          : "Hasil AI itu estimasi — sebelum kesimpan kamu selalu bisa koreksi angkanya dulu."}
      </p>
    </div>
  );
}
