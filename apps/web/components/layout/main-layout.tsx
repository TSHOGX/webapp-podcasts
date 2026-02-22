"use client";

import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { GlobalPlayer } from "../player/global-player";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-28 md:pb-32">
        <div className="max-w-6xl mx-auto p-6 md:p-10 lg:p-12">
          {children}
        </div>
      </main>
      <GlobalPlayer />
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
