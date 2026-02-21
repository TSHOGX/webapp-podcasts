"use client";

import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { GlobalPlayer } from "../player/global-player";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-24 md:pb-24">
        <div className="container mx-auto p-4 md:p-6">{children}</div>
      </main>
      <GlobalPlayer />
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
