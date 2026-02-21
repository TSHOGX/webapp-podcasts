import { NextResponse } from "next/server";
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

interface ITunesPodcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  feedUrl: string;
  artworkUrl600: string;
  primaryGenreName: string;
  description?: string;
}

async function fetchPodcastFromiTunes(id: string): Promise<ITunesPodcast | null> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${id}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.results.length === 0) return null;

    return data.results[0];
  } catch {
    return null;
  }
}

async function parseRSSFeed(feedUrl: string) {
  try {
    const response = await fetch(feedUrl, { next: { revalidate: 3600 } });
    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const feed: RSSFeed = parser.parse(xml);
    const channel = feed.rss.channel;

    const items = Array.isArray(channel.item)
      ? channel.item
      : channel.item
      ? [channel.item]
      : [];

    const episodes = items.map((item, index) => {
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

      return {
        id: `ep-${index}`,
        title: item.title || "Untitled",
        description: item.description || item["content:encoded"] || "",
        audioUrl: item.enclosure?.["@_url"] || "",
        duration,
        publishedAt: item.pubDate || new Date().toISOString(),
      };
    });

    return {
      title: channel.title || "",
      description: channel.description || "",
      episodes,
    };
  } catch (error) {
    console.error("RSS parse error:", error);
    return { title: "", description: "", episodes: [] };
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { id, episodeId } = await params;

  try {
    // Fetch podcast from iTunes
    const podcast = await fetchPodcastFromiTunes(id);

    if (!podcast) {
      return NextResponse.json(
        { error: "Podcast not found" },
        { status: 404 }
      );
    }

    // Parse RSS feed to get episodes
    const rssData = await parseRSSFeed(podcast.feedUrl);

    // Find the specific episode by ID
    const episode = rssData.episodes.find((ep) => ep.id === episodeId);

    if (!episode) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: episode.id,
      title: episode.title,
      description: episode.description,
      audioUrl: episode.audioUrl,
      duration: episode.duration,
      publishedAt: episode.publishedAt,
      podcastTitle: podcast.collectionName,
      podcastImage: podcast.artworkUrl600,
      podcastId: id,
    });
  } catch (error) {
    console.error("Episode fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch episode" },
      { status: 500 }
    );
  }
}
