"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, FileText, Heart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/transcriptions", label: "Transcriptions", icon: FileText },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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

      {/* 底部区域 - 可以添加版本信息或其他 */}
      <div className="p-6">
        <p className="text-xs text-muted-foreground text-center">
          Podcast AI v1.0
        </p>
      </div>
    </aside>
  );
}
