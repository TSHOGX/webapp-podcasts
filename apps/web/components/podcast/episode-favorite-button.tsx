"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/utils";

interface EpisodeFavoriteButtonProps {
  episodeId: string;
  podcastId?: string;
  episodeGuid?: string;
  episodeTitle?: string;
  episodeDescription?: string;
  audioUrl?: string;
  duration?: number;
  publishedAt?: string;
  initialIsFavorited?: boolean;
  className?: string;
}

export function EpisodeFavoriteButton({
  episodeId,
  podcastId,
  episodeGuid,
  episodeTitle,
  episodeDescription,
  audioUrl,
  duration,
  publishedAt,
  initialIsFavorited = false,
  className = ""
}: EpisodeFavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      checkFavoriteStatus();
    } else {
      setChecking(false);
    }
  }, [episodeId, isAuthenticated]);

  const checkFavoriteStatus = async () => {
    try {
      const response = await fetch(getApiUrl("api/episode-favorites"));
      if (response.ok) {
        const data = await response.json();
        const isFav = data.favorites?.some(
          (f: any) =>
            f.episodeId === episodeId ||
            f.episode?.id === episodeId ||
            f.episode?.guid === episodeGuid
        );
        setIsFavorited(isFav);
      }
    } catch {
      // Ignore errors
    } finally {
      setChecking(false);
    }
  };

  const handleToggleFavorite = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "需要登录",
        description: "请先登录后再收藏单集",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isFavorited) {
        // Find and remove favorite
        const response = await fetch(getApiUrl("api/episode-favorites"));
        const data = await response.json();
        const favorite = data.favorites?.find(
          (f: any) =>
            f.episodeId === episodeId ||
            f.episode?.id === episodeId ||
            f.episode?.guid === episodeGuid
        );

        if (favorite) {
          await fetch(getApiUrl(`api/episode-favorites/${favorite.id}`), {
            method: "DELETE",
          });
          setIsFavorited(false);
          toast({
            title: "Success",
            description: "Removed from favorites",
          });
        }
      } else {
        // Add to favorites
        const response = await fetch(getApiUrl("api/episode-favorites"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            episodeId,
            guid: episodeGuid,
            title: episodeTitle,
            description: episodeDescription,
            audioUrl,
            duration,
            publishedAt,
            podcastId,
          }),
        });

        if (response.ok) {
          setIsFavorited(true);
          toast({
            title: "Success",
            description: "Added to favorites",
          });
        } else if (response.status === 409) {
          setIsFavorited(true);
        } else {
          throw new Error("Failed to add favorite");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update favorite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggleFavorite}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 mr-2 ${isFavorited ? "fill-red-500 text-red-500" : ""}`} />
      )}
      {isFavorited ? "Favorited" : "Favorite"}
    </Button>
  );
}
