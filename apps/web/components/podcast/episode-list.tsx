"use client";

import { Play, Clock, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Episode } from "@/types";
import { formatDuration } from "@/lib/utils";

interface ExtendedEpisode extends Episode {
  podcastTitle?: string;
  podcastImage?: string;
}

interface EpisodeListProps {
  episodes: Episode[];
  onPlay: (episode: ExtendedEpisode) => void;
  podcastTitle?: string;
  podcastImage?: string;
}

export function EpisodeList({ episodes, onPlay, podcastTitle, podcastImage }: EpisodeListProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <ScrollArea className="h-[400px] md:h-[600px]">
      <div className="space-y-3 md:space-y-4 pr-2 md:pr-4">
        {episodes.map((episode) => (
          <div
            key={episode.id}
            className="flex items-start gap-2 md:gap-4 p-3 md:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-8 w-8 md:h-10 md:w-10"
              onClick={() => onPlay({ ...episode, podcastTitle, podcastImage })}
            >
              <Play className="h-3 w-3 md:h-4 md:w-4" />
            </Button>

            <div className="flex-1 min-w-0">
              <Link
                href={`/episodes/${episode.id}?podcastId=${encodeURIComponent(episode.podcastId || "")}`}
                className="hover:underline"
              >
                <h4 className="font-medium text-sm md:text-base line-clamp-2 mb-1">{episode.title}</h4>
              </Link>

              {/* Description - Show 1 line on mobile, 2 on desktop */}
              {episode.description && (
                <div
                  className="text-xs md:text-sm text-muted-foreground line-clamp-1 md:line-clamp-2 mb-2"
                  dangerouslySetInnerHTML={{ __html: episode.description }}
                />
              )}

              {/* Metadata - Simplified on mobile */}
              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
                {episode.duration && episode.duration > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(episode.duration)}
                  </span>
                )}
                {episode.publishedAt && (
                  <span className="hidden sm:flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(episode.publishedAt)}
                  </span>
                )}
                <Link
                  href={`/episodes/${episode.id}?podcastId=${encodeURIComponent(episode.podcastId || "")}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <FileText className="h-3 w-3" />
                  <span className="hidden sm:inline">Transcribe</span>
                  <span className="sm:hidden">Transcript</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
