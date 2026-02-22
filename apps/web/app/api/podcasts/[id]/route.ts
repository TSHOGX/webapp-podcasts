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
  guid?: string | { "#text"?: string; "@_isPermaLink"?: string };
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

    const episodes = items.map((item) => {
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

      // Use RSS GUID as episode ID for stability and consistency
      const episodeId =
        typeof item.guid === "string"
          ? item.guid
          : typeof item.guid?.["#text"] === "string"
          ? item.guid["#text"]
          : `${item.title}-${item.pubDate}`;

      return {
        id: episodeId,
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const itunesId = searchParams.get("itunesId") || id;

  try {
    const podcast = await fetchPodcastFromiTunes(itunesId);

    if (!podcast) {
      return NextResponse.json(
        { error: "Podcast not found" },
        { status: 404 }
      );
    }

    const rssData = await parseRSSFeed(podcast.feedUrl);

    return NextResponse.json({
      id: podcast.collectionId.toString(),
      itunesId: podcast.collectionId,
      title: podcast.collectionName,
      author: podcast.artistName,
      description: podcast.description || rssData.description,
      rssUrl: podcast.feedUrl,
      artworkUrl: podcast.artworkUrl600,
      genre: podcast.primaryGenreName,
      episodes: rssData.episodes,
    });
  } catch (error) {
    console.error("Podcast fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch podcast" },
      { status: 500 }
    );
  }
}
