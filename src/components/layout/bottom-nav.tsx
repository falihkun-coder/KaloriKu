"use client"

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  UtensilsCrossed,
  Plus,
  ScanLine,
  LayoutGrid,
  Calculator,
  TrendingUp,
  CalendarDays,
  CalendarCheck,
  ChartColumnBig,
  BookMarked,
  MonitorPlay,
  Target,
  Dumbbell,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentToggle } from "@/components/accent-toggle";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Semua halaman — buat drawer "Lainnya" biar semua kejangkau dari hp.
const ALL_PAGES = [
  { href: "/", icon: Home, label: "Beranda" },
  { href: "/riwayat", icon: UtensilsCrossed, label: "Riwayat" },
  { href: "/rencana", icon: CalendarCheck, label: "Rencana" },
  { href: "/scan", icon: ScanLine, label: "Scan AI" },
  { href: "/simulator", icon: Calculator, label: "Simulator" },
  { href: "/rekap", icon: ChartColumnBig, label: "Rekap" },
  { href: "/tren", icon: TrendingUp, label: "Berat & Tren" },
  { href: "/jadwal", icon: CalendarDays, label: "Jadwal" },
  { href: "/library", icon: BookMarked, label: "Meal Library" },
  { href: "/musik", icon: MonitorPlay, label: "Video & Musik" },
  { href: "/goals", icon: Target, label: "Goals & Setting" },
];

export function BottomNav() {
  const pathname = usePathname();
  const openFoodDialog = useStore((state) => state.openFoodDialog);
  const openExerciseDialog = useStore((state) => state.openExerciseDialog);
  const [menuOpen, setMenuOpen] = useState(false);

  const barItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/riwayat", icon: UtensilsCrossed, label: "Riwayat" },
    { href: "#tambah", icon: Plus, label: "Tambah", isFab: true },
    { href: "/scan", icon: ScanLine, label: "Scan" },
  ];

  return (
    <>
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto flex justify-around items-center h-[62px] max-w-md mx-auto relative px-2 rounded-[26px] border border-border bg-card/95 backdrop-blur-md shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
          {barItems.map((item) => {
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

          {/* Lainnya → drawer semua halaman */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Menu lainnya"
            className={cn(
              "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
              menuOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <LayoutGrid size={21} strokeWidth={2} />
            <span className="text-[10px] font-medium">Lainnya</span>
          </button>
        </div>
      </nav>

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent className="md:hidden">
          <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1">
            <DrawerTitle className="px-1 pb-3 pt-1 text-left">Menu</DrawerTitle>

            {/* Grid semua halaman */}
            <div className="grid grid-cols-3 gap-2">
              {ALL_PAGES.map((p) => {
                const isActive = pathname === p.href;
                const Icon = p.icon;
                return (
                  <Link
                    key={p.href}
                    href={p.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-[14px] border px-2 py-3 text-center transition-colors",
                      isActive
                        ? "border-primary/40 bg-accent text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/30"
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                    <span className="text-[11px] font-semibold leading-tight">{p.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Aksi cepat + kontrol */}
            <div className="mt-3 space-y-2">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  openExerciseDialog();
                }}
                className="flex w-full items-center justify-center gap-2 h-11 rounded-[12px] border border-border text-[13px] font-semibold text-foreground hover:border-primary/40 transition-colors"
              >
                <Dumbbell size={17} /> Catat olahraga
              </button>
              <div className="flex items-center justify-between rounded-[12px] border border-border px-3.5 h-11">
                <span className="text-[12px] font-medium text-muted-foreground">Warna aksen</span>
                <AccentToggle />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center justify-between rounded-[12px] border border-border px-3.5 h-11">
                  <span className="text-[12px] font-medium text-muted-foreground">Tema gelap / terang</span>
                  <ThemeToggle className="h-8 w-8" />
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut(auth);
                  }}
                  aria-label="Keluar"
                  className="h-11 w-11 rounded-[12px] border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
