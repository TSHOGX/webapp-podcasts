"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PodcastCard } from "@/components/podcast/podcast-card";
import { Podcast } from "@/types";
import { getApiUrl } from "@/lib/utils";

function SearchResults() {
  const searchParams = useSearchParams();
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

  if (!query) {
    return (
      <div className="text-center text-muted-foreground py-20">
        Enter a search term to find podcasts
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
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
      <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">
        Search Results for &quot;{query}&quot;
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {podcasts.map((podcast) => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
