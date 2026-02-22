"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

interface EpisodeCardProps {
  episode: {
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
    };
  };
  variant?: "horizontal" | "vertical";
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else if (diffInDays < 30) {
    return `${Math.floor(diffInDays / 7)}w ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

export function EpisodeCard({ episode, variant = "vertical" }: EpisodeCardProps) {
  const podcastLink = `/${episode.podcast.id}${
    episode.podcast.itunesId ? `?itunesId=${episode.podcast.itunesId}` : ""
  }`;

  if (variant === "horizontal") {
    return (
      <Link href={podcastLink}>
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-3">
            <div className="flex gap-3">
              <div className="w-16 h-16 flex-shrink-0 relative bg-muted rounded overflow-hidden">
                {episode.podcast.artworkUrl ? (
                  <Image
                    src={episode.podcast.artworkUrl}
                    alt={episode.podcast.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No Image
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-2 mb-1">
                  {episode.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {episode.podcast.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(episode.publishedAt)}</span>
                  {episode.duration ? (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(episode.duration)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={podcastLink}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full group">
        <div className="aspect-square relative bg-muted">
          {episode.podcast.artworkUrl ? (
            <Image
              src={episode.podcast.artworkUrl}
              alt={episode.podcast.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
        <CardContent className="p-3">
          <h4 className="font-semibold text-sm line-clamp-2 mb-1">
            {episode.title}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {episode.podcast.title}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatRelativeTime(episode.publishedAt)}</span>
            {episode.duration ? (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatDuration(episode.duration)}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
