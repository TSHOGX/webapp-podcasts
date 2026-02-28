"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProtectedContent } from "@/components/auth/protected-content";
import { EpisodeFavorite } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";

function EpisodeFavoritesContent() {
  const [favorites, setFavorites] = useState<EpisodeFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await fetch(getApiUrl("api/episode-favorites"));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch episode favorites");
      }

      setFavorites(data.favorites || []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch episode favorites",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`api/episode-favorites/${id}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove favorite");
      }

      setFavorites(favorites.filter((f) => f.id !== id));
      toast({
        title: "Success",
        description: "Episode removed from favorites",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/favorites">
          <Button variant="ghost" size="sm">
            &larr; Back to Favorites
          </Button>
        </Link>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Saved Episodes</h1>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center text-muted-foreground py-20 bg-muted/30 rounded-3xl">
          No saved episodes yet. Visit an episode page and click the favorite button to save it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {favorites.map((favorite) => (
            <Card key={favorite.id} className="overflow-hidden h-full group flex flex-col">
              <Link
                href={`/episodes/${favorite.episode?.id}?podcastId=${favorite.episode?.podcastId}`}
                className="block"
              >
                <div className="aspect-square relative bg-muted overflow-hidden rounded-t-2xl">
                  {favorite.episode?.podcast?.artworkUrl ? (
                    <Image
                      src={favorite.episode.podcast.artworkUrl}
                      alt={favorite.episode?.podcast?.title || ""}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </Link>
              <CardContent className="p-5 pt-4 flex-1 flex flex-col">
                <Link
                  href={`/episodes/${favorite.episode?.id}?podcastId=${favorite.episode?.podcastId}`}
                >
                  <h3 className="font-semibold line-clamp-2 mb-1.5 group-hover:text-primary transition-colors text-base leading-snug">
                    {favorite.episode?.title}
                  </h3>
                </Link>
                <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                  {favorite.episode?.podcast?.title}
                </p>
                {favorite.episode?.publishedAt && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {new Date(favorite.episode.publishedAt).toLocaleDateString()}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 mt-auto"
                  onClick={() => handleRemove(favorite.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EpisodeFavoritesPage() {
  return (
    <ProtectedContent
      title="需要登录"
      description="登录后可以收藏您喜欢的单集，方便日后快速访问。"
    >
      <EpisodeFavoritesContent />
    </ProtectedContent>
  );
}
