"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { EpisodeCard } from "./episode-card";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface FavoriteUpdate {
  id: string;
  title: string;
  publishedAt: string;
  duration?: number;
  audioUrl?: string;
  podcast: {
    id: string;
    title: string;
    artworkUrl?: string;
    itunesId?: number;
    rssUrl?: string;
  };
}

export function FavoriteUpdates() {
  const [updates, setUpdates] = useState<FavoriteUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const fetchUpdates = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        getApiUrl("api/favorites/updates?limit=12&episodesPerPodcast=2")
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch updates");
      }

      const data = await response.json();
      setUpdates(data.updates || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchUpdates}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground mb-2">No recent updates from your favorites</p>
        <p className="text-sm text-muted-foreground">
          New episodes will appear here when they&apos;re released
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Latest from Your Favorites</h3>
        <Link
          href="/favorites"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Desktop: Grid, Mobile: Horizontal scroll */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {updates.slice(0, 8).map((episode) => (
          <EpisodeCard key={`${episode.podcast.id}-${episode.id}`} episode={episode} />
        ))}
      </div>

      {/* Mobile: Horizontal scroll */}
      <div className="sm:hidden -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-4 pb-4" style={{ width: "max-content" }}>
          {updates.map((episode) => (
            <div key={`${episode.podcast.id}-${episode.id}`} className="w-40 flex-shrink-0">
              <EpisodeCard episode={episode} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
