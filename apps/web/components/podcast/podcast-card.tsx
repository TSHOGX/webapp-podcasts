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
    <Link href={`/${podcast.id}?itunesId=${podcast.itunesId}`} className="group block">
      <Card className="overflow-hidden h-full">
        <div className="aspect-square relative bg-muted overflow-hidden rounded-2xl">
          {podcast.artworkUrl ? (
            <Image
              src={podcast.artworkUrl}
              alt={podcast.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          {/* 柔和渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        <CardContent className="p-5 pt-4">
          <h3 className="font-semibold line-clamp-2 mb-1.5 text-base leading-snug group-hover:text-primary transition-colors">
            {podcast.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
            {podcast.author}
          </p>
          {podcast.genre && (
            <span className="inline-flex items-center text-xs font-medium bg-accent/60 text-accent-foreground px-3 py-1.5 rounded-full">
              {podcast.genre}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
