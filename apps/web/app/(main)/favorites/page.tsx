"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProtectedContent } from "@/components/auth/protected-content";
import { Favorite } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";
import { FavoriteUpdates } from "@/components/podcast/favorite-updates";

function FavoritesContent() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await fetch(getApiUrl("api/favorites"));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch favorites");
      }

      setFavorites(data.favorites);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch favorites",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`api/favorites/${id}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove favorite");
      }

      setFavorites(favorites.filter((f) => f.id !== id));
      toast({
        title: "Success",
        description: "Favorite removed successfully",
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
      <h1 className="font-display text-2xl md:text-3xl font-bold">Favorites</h1>

      {/* Latest Updates Section */}
      <section className="mb-12">
        <FavoriteUpdates linkToEpisode={true} showViewAll={true} />
      </section>

      {favorites.length === 0 ? (
        <div className="text-center text-muted-foreground py-20 bg-muted/30 rounded-3xl">
          No favorites yet. Search for podcasts and add them to your favorites.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {favorites.map((favorite) => (
            <Card key={favorite.id} className="overflow-hidden h-full group">
              <Link href={`/${favorite.podcast?.id}?itunesId=${favorite.podcast?.itunesId}`} className="block">
                <div className="aspect-square relative bg-muted overflow-hidden rounded-2xl">
                  {favorite.podcast?.artworkUrl ? (
                    <Image
                      src={favorite.podcast.artworkUrl}
                      alt={favorite.podcast.title}
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
              <CardContent className="p-5 pt-4">
                <Link href={`/${favorite.podcast?.id}?itunesId=${favorite.podcast?.itunesId}`}>
                  <h3 className="font-semibold line-clamp-2 mb-1.5 group-hover:text-primary transition-colors text-base leading-snug">
                    {favorite.podcast?.title}
                  </h3>
                </Link>
                <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                  {favorite.podcast?.author}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
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

export default function FavoritesPage() {
  return (
    <ProtectedContent
      title="需要登录"
      description="登录后可以收藏您喜欢的播客，方便日后快速访问。"
    >
      <FavoritesContent />
    </ProtectedContent>
  );
}
