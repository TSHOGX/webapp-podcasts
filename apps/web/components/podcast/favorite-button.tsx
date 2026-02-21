"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Podcast } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/utils";

interface FavoriteButtonProps {
  podcast: Podcast;
}

export function FavoriteButton({ podcast }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      checkFavoriteStatus();
    }
  }, [podcast.id, isAuthenticated]);

  const checkFavoriteStatus = async () => {
    try {
      const response = await fetch(getApiUrl("api/favorites"));
      if (response.ok) {
        const data = await response.json();
        const isFav = data.favorites?.some(
          (f: any) => f.podcast?.itunes_id === podcast.itunesId
        );
        setIsFavorited(isFav);
      }
    } catch {
      // Ignore errors
    }
  };

  const handleToggleFavorite = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "需要登录",
        description: "请先登录后再收藏播客",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isFavorited) {
        // Find and remove favorite
        const response = await fetch(getApiUrl("api/favorites"));
        const data = await response.json();
        const favorite = data.favorites?.find(
          (f: any) => f.podcast?.itunes_id === podcast.itunesId
        );

        if (favorite) {
          await fetch(getApiUrl(`api/favorites/${favorite.id}`), {
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
        const response = await fetch(getApiUrl("api/favorites"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            podcastId: podcast.id,
            itunesId: podcast.itunesId,
            title: podcast.title,
            author: podcast.author,
            description: podcast.description,
            rssUrl: podcast.rssUrl,
            artworkUrl: podcast.artworkUrl,
            genre: podcast.genre,
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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggleFavorite}
      disabled={loading}
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
