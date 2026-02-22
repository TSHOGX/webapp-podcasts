"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Heart, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FavoriteUpdates } from "./favorite-updates";
import { Separator } from "@/components/ui/separator";

interface UserHomeProps {
  userName?: string;
}

export function UserHome({ userName }: UserHomeProps) {
  const router = useRouter();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("query")?.toString().trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="space-y-12">
      {/* Welcome Section */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Welcome back{userName ? <>, <span className="text-primary">{userName}</span></> : ""}
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Discover new episodes from your favorite podcasts
        </p>
      </div>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            name="query"
            placeholder="Search podcasts..."
            className="pl-14 h-14 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="h-14 px-8">
          Search
        </Button>
      </form>

      <Separator className="opacity-50" />

      {/* Latest Updates */}
      <section>
        <FavoriteUpdates linkToEpisode={true} showViewAll={true} />
      </section>

      <Separator className="opacity-50" />

      {/* Quick Access Cards */}
      <section className="grid sm:grid-cols-2 gap-4">
        <Link href="/favorites" className="group">
          <div className="flex items-center gap-5 p-6 rounded-3xl bg-muted/50 hover:bg-accent transition-colors duration-200">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                View All Favorites
              </p>
              <p className="text-sm text-muted-foreground">
                Browse and manage your saved podcasts
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </Link>

        <Link href="/search" className="group">
          <div className="flex items-center gap-5 p-6 rounded-3xl bg-muted/50 hover:bg-accent transition-colors duration-200">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                Discover New Podcasts
              </p>
              <p className="text-sm text-muted-foreground">
                Search millions of podcasts
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </Link>
      </section>
    </div>
  );
}
