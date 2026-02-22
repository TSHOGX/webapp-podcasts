import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { XMLParser } from "fast-xml-parser";

interface RSSItem {
  title: string;
  description?: string;
  enclosure?: {
    "@_url": string;
    "@_type"?: string;
    "@_length"?: string;
  };
  "content:encoded"?: string;
  pubDate?: string;
  duration?: string;
  "itunes:duration"?: string;
  guid?: string | { "#text": string };
}

interface RSSChannel {
  title: string;
  description: string;
  item: RSSItem | RSSItem[];
}

interface RSSFeed {
  rss: {
    channel: RSSChannel;
  };
}

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

async function fetchLatestEpisodes(
  podcastId: string,
  rssUrl: string | null | undefined,
  podcastTitle: string,
  artworkUrl: string | null | undefined,
  itunesId: number | null | undefined,
  limit: number = 3
): Promise<FavoriteUpdate[]> {
  if (!rssUrl) {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(rssUrl, {
      signal: controller.signal,
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch RSS feed for ${podcastTitle}: ${response.status}`);
      return [];
    }

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const feed: RSSFeed = parser.parse(xml);
    const channel = feed.rss?.channel;

    if (!channel) {
      return [];
    }

    const items = Array.isArray(channel.item)
      ? channel.item
      : channel.item
      ? [channel.item]
      : [];

    const episodes: FavoriteUpdate[] = items.slice(0, limit).map((item) => {
      const durationStr = item["itunes:duration"] || item.duration;
      let duration = 0;
      if (durationStr) {
        const parts = durationStr.split(":").map(Number);
        if (parts.length === 3) {
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          duration = parts[0] * 60 + parts[1];
        } else {
          duration = parseInt(durationStr) || 0;
        }
      }

      // Generate unique episode ID from guid or title+pubDate
      const episodeId =
        typeof item.guid === "string"
          ? item.guid
          : typeof item.guid?.["#text"] === "string"
          ? item.guid["#text"]
          : `${item.title}-${item.pubDate}`;

      return {
        id: episodeId,
        title: item.title || "Untitled Episode",
        publishedAt: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
        duration: duration || undefined,
        audioUrl: item.enclosure?.["@_url"],
        podcast: {
          id: podcastId,
          title: podcastTitle,
          artworkUrl: artworkUrl || undefined,
          itunesId: itunesId || undefined,
          rssUrl: rssUrl,
        },
      };
    });

    return episodes;
  } catch (error) {
    console.error(
      `RSS parse error for ${podcastTitle}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const episodesPerPodcast = parseInt(
      searchParams.get("episodesPerPodcast") || "2",
      10
    );

    const supabase = await createClient();

    // Get user's favorites with podcast details
    const { data: favorites, error: dbError } = await supabase
      .from("pc_favorites")
      .select(
        `
        id,
        podcast:podcast_id (
          id,
          itunes_id,
          title,
          rss_url,
          artwork_url
        )
      `
      )
      .eq("user_id", user!.id);

    if (dbError) {
      console.error("Database error:", dbError);
      throw dbError;
    }

    if (!favorites || favorites.length === 0) {
      return NextResponse.json({ updates: [] });
    }

    // Fetch latest episodes from each podcast's RSS feed in parallel
    const updatePromises = favorites.map(async (f: any) => {
      const podcast = f.podcast;
      if (!podcast) return [];

      // Use itunes_id as podcast id if available, otherwise fall back to database id
      const effectivePodcastId = podcast.itunes_id ? String(podcast.itunes_id) : podcast.id;
      return fetchLatestEpisodes(
        effectivePodcastId,
        podcast.rss_url,
        podcast.title,
        podcast.artwork_url,
        podcast.itunes_id,
        episodesPerPodcast
      );
    });

    const allUpdatesArrays = await Promise.all(updatePromises);
    const allUpdates = allUpdatesArrays.flat();

    // Sort by published date (newest first) and limit results
    allUpdates.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const limitedUpdates = allUpdates.slice(0, limit);

    return NextResponse.json({ updates: limitedUpdates });
  } catch (error) {
    console.error("Fetch favorite updates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorite updates" },
      { status: 500 }
    );
  }
}
