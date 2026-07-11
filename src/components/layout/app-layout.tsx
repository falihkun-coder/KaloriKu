"use client"

import { BottomNav } from "./bottom-nav";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { FoodDialog } from "@/components/food/food-dialog";

import { Sidebar } from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const fetchData = useStore((state) => state.fetchData);
  const isLoading = useStore((state) => state.isLoading);
  const pathname = usePathname();
  const { user } = useAuth();

  const storeUserId = useStore((state) => state.userId);

  useEffect(() => {
    // Only fetch if not on login page and we haven't already fetched data for this user
    if (pathname !== "/login" && user && storeUserId !== user.uid) {
      fetchData(user.uid);
    }
  }, [fetchData, pathname, user, storeUserId]);

  if (pathname === "/login") {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex bg-background overflow-hidden text-foreground">
      <div className="flex w-full h-screen">
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 w-full h-full overflow-y-auto relative pb-20 md:pb-6 px-4 md:px-10 pt-8 scrollbar-hide">
          <main className="min-h-full w-full max-w-[1400px] mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : (
              children
            )}
          </main>
          <BottomNav />
        </div>
      </div>

      {/* Dialog tambah/edit makan — global, bisa dibuka dari sidebar, FAB, dan empty state */}
      <FoodDialog />
    </div>
  );
}
