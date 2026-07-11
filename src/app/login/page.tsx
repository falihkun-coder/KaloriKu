"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Loader2, LockKeyhole, Flame } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Isi email & password dulu");
      return;
    }
    setIsLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Akun berhasil dibuat!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Selamat datang!");
      }
    } catch (error: unknown) {
      console.error(error);
      const code = (error as { code?: string })?.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        toast.error("Email atau password salah");
      } else if (code === "auth/email-already-in-use") {
        toast.error("Email sudah terdaftar");
      } else {
        toast.error((error as Error)?.message || "Gagal masuk");
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
        <h2 className="font-heading text-lg font-bold">{isRegistering ? "Buat akun" : "Masuk"}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          {isRegistering ? "Daftar buat mulai catat makanmu." : "Masukin email & password buat akses dashboard."}
        </p>

        <form onSubmit={handleAuth} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="h-11 rounded-[12px] bg-background" required />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="h-11 rounded-[12px] bg-background" required />

          <button type="submit" disabled={isLoading}
            className="w-full h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {isRegistering ? "Daftar" : "Masuk"}
          </button>
          <button type="button" onClick={() => setIsRegistering(!isRegistering)} disabled={isLoading}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
            {isRegistering ? "Udah punya akun? Masuk" : "Belum punya akun? Daftar"}
          </button>
        </form>
      </div>
    </div>
  );
}
