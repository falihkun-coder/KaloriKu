"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, Plus, Target, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

export function BottomNav() {
  const pathname = usePathname();
  const openFoodDialog = useStore((state) => state.openFoodDialog);

  const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/riwayat", icon: UtensilsCrossed, label: "Riwayat" },
    { href: "#tambah", icon: Plus, label: "Tambah", isFab: true },
    { href: "/scan", icon: ScanLine, label: "Scan" },
    { href: "/goals", icon: Target, label: "Goals" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex justify-around items-center h-[66px] max-w-md mx-auto relative px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <div key={item.href} className="relative -top-3.5">
                <button
                  onClick={() => openFoodDialog()}
                  aria-label="Catat makan"
                  className="flex items-center justify-center w-[50px] h-[50px] bg-primary text-primary-foreground rounded-full shadow-[0_10px_22px_var(--accent-shadow)] transition-transform active:scale-95"
                >
                  <Icon size={26} />
                </button>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
