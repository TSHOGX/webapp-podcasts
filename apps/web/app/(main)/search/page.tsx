"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PodcastCard } from "@/components/podcast/podcast-card";
import { SearchHero } from "@/components/podcast/search-hero";
import { Podcast } from "@/types";
import { getApiUrl } from "@/lib/utils";

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q");
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query) return;

    const fetchPodcasts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          getApiUrl(`api/podcasts/search?q=${encodeURIComponent(query)}&limit=20`)
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to search podcasts");
        }

        setPodcasts(data.podcasts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchPodcasts();
  }, [query]);

  const handleSearch = (searchQuery: string) => {
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  if (!query) {
    return (
      <div className="py-12">
        <SearchHero
          defaultQuery=""
          onSearch={handleSearch}
          title="Discover Podcasts"
          description="Search millions of podcasts, transcribe episodes, and build your personal library."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-20">{error}</div>
    );
  }

  if (podcasts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-20">
        No podcasts found for &quot;{query}&quot;
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl md:text-3xl font-bold mb-6 md:mb-8">
        Search Results for <span className="text-primary">&quot;{query}&quot;</span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {podcasts.map((podcast) => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
