"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Podcast } from "@/types";

interface PodcastCardProps {
  podcast: Podcast;
}

export function PodcastCard({ podcast }: PodcastCardProps) {
  return (
    <Link href={`/${podcast.id}?itunesId=${podcast.itunesId}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="aspect-square relative bg-muted">
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
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-2 mb-1">{podcast.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {podcast.author}
          </p>
          {podcast.genre && (
            <span className="inline-block mt-2 text-xs bg-muted px-2 py-1 rounded-full">
              {podcast.genre}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
