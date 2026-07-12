"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, Plus, Target, LogOut, Flame, ScanLine, Calculator, TrendingUp, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentToggle } from "@/components/accent-toggle";
import { useStore } from "@/store/useStore";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const openFoodDialog = useStore((state) => state.openFoodDialog);

  const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/riwayat", icon: UtensilsCrossed, label: "Riwayat" },
    { href: "/scan", icon: ScanLine, label: "Scan AI" },
    { href: "/simulator", icon: Calculator, label: "Simulator" },
    { href: "/tren", icon: TrendingUp, label: "Berat & Tren" },
    { href: "/library", icon: BookMarked, label: "Meal Library" },
    { href: "/goals", icon: Target, label: "Goals & Setting" },
  ];

  const email = user?.email || "";
  const name = user?.displayName || (email ? email.split("@")[0] : "Pengguna");
  const avatarInitial = (name[0] || "U").toUpperCase();

  return (
    <aside className="hidden md:flex w-[248px] flex-col bg-card border-r border-border h-screen sticky top-0 p-5 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-1">
        <div className="w-9 h-9 rounded-[11px] bg-primary flex items-center justify-center shadow-[0_6px_16px_var(--accent-shadow)]">
          <Flame className="text-primary-foreground w-5 h-5" />
        </div>
        <div className="leading-tight">
          <p className="font-heading font-bold text-[15px] tracking-tight text-foreground">KaloriKu</p>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">CALORIE TRACKER</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm transition-colors",
                isActive
                  ? "bg-accent text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Controls */}
      <div className="mt-auto pt-5 border-t border-border/70 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">Aksen</span>
          <AccentToggle />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">Tema</span>
          <ThemeToggle className="h-9 w-9" />
        </div>

        <button
          onClick={() => openFoodDialog()}
          className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-2.5 rounded-[12px] font-semibold text-sm shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98]"
        >
          <Plus size={18} />
          <span>Catat makan</span>
        </button>

        {/* Profile */}
        <div className="flex items-center gap-2.5 rounded-[14px] border border-border bg-muted/30 p-2.5">
          <div className="h-9 w-9 rounded-full bg-accent text-primary flex items-center justify-center font-bold text-sm shrink-0">
            {avatarInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground truncate capitalize">{name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
          </div>
          <button
            onClick={() => signOut(auth)}
            aria-label="Keluar"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
