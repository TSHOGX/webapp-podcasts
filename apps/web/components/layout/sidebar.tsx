"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, FileText, Heart, LogOut } from "lucide-react";
import { cn, getApiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ThemeSelector } from "@/components/theme-selector";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/transcriptions", label: "Transcriptions", icon: FileText },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      await fetch(getApiUrl("api/auth/logout"), { method: "POST" });
    }
    router.push("/login");
  };

  return (
    <aside className="hidden md:flex w-[280px] bg-muted/30 flex-col">
      {/* Logo区域 */}
      <div className="p-10 pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Podcast
          <span className="text-primary">AI</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Transcribe & Discover</p>
      </div>

      {/* 导航区域 */}
      <nav className="flex-1 px-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 底部区域 */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeSelector />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-4 rounded-2xl h-12 hover:bg-accent"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
