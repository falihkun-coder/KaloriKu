"use client";

import { useState } from "react";
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, Flame } from "lucide-react";
import { toast } from "sonner";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.14 7.14 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast.success("Selamat datang!");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user nutup popup — bukan error
      } else if (code === "auth/popup-blocked") {
        // popup keblokir browser → pakai full-page redirect
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      } else if (code === "auth/unauthorized-domain") {
        toast.error("Domain ini belum diizinkan — tambah kaloriku-d9f2f.web.app di Authentication → Settings → Authorized domains");
      } else if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") {
        toast.error("Provider Google belum diaktifkan di Firebase console");
      } else {
        console.error(error);
        toast.error("Gagal masuk pakai Google");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm p-4">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-14 h-14 bg-primary rounded-[18px] flex items-center justify-center mb-4 shadow-[0_10px_24px_var(--accent-shadow)]">
          <Flame size={28} className="text-primary-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight mb-1">KaloriKu</h1>
        <p className="text-muted-foreground text-sm">Jurnal makanmu, dicatat tanpa ribet</p>
      </div>

      <div className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold">Masuk</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Sekali klik pakai akun Google, langsung ke dashboard.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={isLoading}
          className="w-full h-12 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-6 w-6 rounded-full bg-white flex items-center justify-center shrink-0">
              <GoogleIcon />
            </span>
          )}
          Masuk pakai Google
        </button>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Datamu cuma bisa diakses akunmu sendiri.
        </p>
      </div>
    </div>
  );
}
