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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Discover new episodes from your favorite podcasts
        </p>
      </div>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="query"
            placeholder="Search podcasts..."
            className="pl-10 h-12"
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      <Separator />

      {/* Latest Updates */}
      <section>
        <FavoriteUpdates />
      </section>

      <Separator />

      {/* Favorites Quick Access */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Your Favorites</h3>
          <Link
            href="/favorites"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Manage
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/favorites" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-auto py-6 justify-start gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">View All Favorites</p>
                <p className="text-sm text-muted-foreground">
                  Browse and manage your saved podcasts
                </p>
              </div>
            </Button>
          </Link>
          <Link href="/search" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-auto py-6 justify-start gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Search className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">Discover New Podcasts</p>
                <p className="text-sm text-muted-foreground">
                  Search millions of podcasts
                </p>
              </div>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
