"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { EpisodeList } from "@/components/podcast/episode-list";
import { FavoriteButton } from "@/components/podcast/favorite-button";
import { usePlayerStore } from "@/store/player-store";
import { Podcast, Episode } from "@/types";
import { getApiUrl } from "@/lib/utils";

export default function PodcastDetailPage() {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const params = useParams();
  const itunesId = searchParams.get("itunesId");
  const setCurrentEpisode = usePlayerStore((state) => state.setCurrentEpisode);
  const id = params.id as string;

  useEffect(() => {
    const fetchPodcast = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await fetch(
          getApiUrl(`api/podcasts/${id}?itunesId=${itunesId || id}`)
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch podcast");
        }

        setPodcast(data);
        // Add podcastId to each episode - use itunesId if available, otherwise fall back to id
        const effectivePodcastId = itunesId || id;
        const episodesWithPodcastId = data.episodes.map((episode: Episode) => ({
          ...episode,
          podcastId: effectivePodcastId,
        }));
        setEpisodes(episodesWithPodcastId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchPodcast();
  }, [id, itunesId]);

  const handlePlay = (episode: Episode & { podcastTitle?: string; podcastImage?: string }) => {
    setCurrentEpisode({
      ...episode,
      podcastTitle: podcast?.title,
      podcastImage: podcast?.artworkUrl,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <div className="text-center text-destructive py-20">
        {error || "Podcast not found"}
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Podcast Header - Responsive: vertical on mobile, horizontal on desktop */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Podcast Image - Smaller on mobile */}
        <div className="w-40 h-40 md:w-48 md:h-48 shrink-0 mx-auto md:mx-0 relative bg-muted rounded-3xl overflow-hidden shadow-soft">
          {podcast.artworkUrl ? (
            <Image
              src={podcast.artworkUrl}
              alt={podcast.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
        </div>

        {/* Podcast Info */}
        <div className="flex-1 space-y-4 md:space-y-5 text-center md:text-left">
          <div>
            <h1 className="font-display text-2xl md:text-4xl font-bold mb-2 leading-tight">{podcast.title}</h1>
            <p className="text-base md:text-lg text-muted-foreground">{podcast.author}</p>
          </div>

          {podcast.genre && (
            <span className="inline-flex items-center text-xs font-medium bg-accent/60 text-accent-foreground px-3 py-1.5 rounded-full">
              {podcast.genre}
            </span>
          )}

          {podcast.description && (
            <div className="max-w-2xl max-h-[200px] overflow-y-auto">
              <div
                className="text-sm md:text-base text-muted-foreground prose prose-sm max-w-none leading-relaxed"
                dangerouslySetInnerHTML={{ __html: podcast.description }}
              />
            </div>
          )}

          <div className="flex justify-center md:justify-start">
            <FavoriteButton
              podcast={{
                id: podcast.id,
                itunesId: podcast.itunesId,
                title: podcast.title,
                author: podcast.author,
                description: podcast.description,
                rssUrl: podcast.rssUrl,
                artworkUrl: podcast.artworkUrl,
                genre: podcast.genre,
              }}
            />
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="space-y-6">
        <h2 className="font-display text-xl md:text-2xl font-bold">Episodes ({episodes.length})</h2>
        <EpisodeList
          episodes={episodes}
          onPlay={handlePlay}
          podcastTitle={podcast.title}
          podcastImage={podcast.artworkUrl}
        />
      </div>
    </div>
  );
}
