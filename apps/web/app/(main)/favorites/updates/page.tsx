"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { EpisodeCard } from "@/components/podcast/episode-card";
import { Button } from "@/components/ui/button";
import { ProtectedContent } from "@/components/auth/protected-content";
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

function UpdatesContent() {
  const [updates, setUpdates] = useState<FavoriteUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const fetchUpdates = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        getApiUrl("api/favorites/updates?limit=50&episodesPerPodcast=5")
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
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/favorites">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Favorites
        </Button>
      </Link>

      <h1 className="font-display text-2xl md:text-3xl font-bold">
        Latest from Your Favorites
      </h1>

      {error ? (
        <div className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchUpdates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center text-muted-foreground py-20 bg-muted/30 rounded-3xl">
          <p className="mb-2">No recent updates from your favorites</p>
          <p className="text-sm">
            New episodes will appear here when they&apos;re released
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((episode) => (
            <EpisodeCard
              key={`${episode.podcast.id}-${episode.id}`}
              episode={episode}
              variant="horizontal"
              linkToEpisode={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UpdatesPage() {
  return (
    <ProtectedContent
      title="需要登录"
      description="登录后可以查看您收藏播客的最新更新。"
    >
      <UpdatesContent />
    </ProtectedContent>
  );
}
