"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchHeroProps {
  defaultQuery?: string;
  onSearch?: (query: string) => void;
  title?: string;
  description?: string;
}

export function SearchHero({
  defaultQuery = "",
  onSearch,
  title = "Discover Podcasts",
  description = "Search millions of podcasts, transcribe episodes, and build your personal library.",
}: SearchHeroProps) {
  const [query, setQuery] = useState(defaultQuery);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (onSearch) {
        onSearch(query.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <div className="text-center space-y-12 py-16 md:py-24">
      <div className="space-y-8">
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
          <Input
            placeholder="Search podcasts..."
            className="pl-14 h-14 text-base shadow-inner-soft"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="h-14 px-8">
          Search
        </Button>
      </form>
    </div>
  );
}
