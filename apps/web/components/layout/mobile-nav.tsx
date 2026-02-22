"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, FileText, Heart, LogOut } from "lucide-react";
import { cn, getApiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/transcriptions", label: "Transcriptions", icon: FileText },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

export function MobileNav() {
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
    <nav className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
      <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-soft-lg px-2 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 px-3 py-2 h-auto text-muted-foreground hover:text-foreground hover:bg-accent min-w-[60px] rounded-xl"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-[10px] font-medium">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
