import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

interface ITunesPodcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  feedUrl: string;
  artworkUrl600: string;
  primaryGenreName: string;
}

interface ITunesSearchResponse {
  results: ITunesPodcast[];
}

interface RSSItem {
  pubDate?: string;
}

interface RSSChannel {
  item?: RSSItem | RSSItem[];
}

interface RSSFeed {
  rss?: {
    channel?: RSSChannel;
  };
}

async function getLatestEpisodeDate(feedUrl: string): Promise<Date | null> {
  try {
    const response = await fetch(feedUrl, { next: { revalidate: 3600 } });
    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: true,
    });
    const feed: RSSFeed = parser.parse(xml);
    const channel = feed.rss?.channel;

    if (!channel?.item) return null;

    const items = Array.isArray(channel.item)
      ? channel.item
      : [channel.item];

    if (items.length === 0) return null;

    // Get the most recent episode date (first item in RSS is usually latest)
    const latestItem = items[0];
    if (latestItem.pubDate) {
      return new Date(latestItem.pubDate);
    }

    return null;
  } catch (error) {
    console.error(`Failed to parse RSS for ${feedUrl}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=${limit}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error("iTunes API request failed");
    }

    const data: ITunesSearchResponse = await response.json();

    const podcasts = data.results.map((item) => ({
      id: item.collectionId.toString(),
      itunesId: item.collectionId,
      title: item.collectionName,
      author: item.artistName,
      artworkUrl: item.artworkUrl600 || "",
      feedUrl: item.feedUrl,
      genre: item.primaryGenreName,
    }));

    // Fetch latest episode dates for sorting and filtering
    const podcastsWithDates = await Promise.all(
      podcasts.map(async (podcast) => {
        const lastEpisodeDate = await getLatestEpisodeDate(podcast.feedUrl);
        return { ...podcast, lastEpisodeDate };
      })
    );

    // Filter out podcasts with no episodes and sort by latest episode date
    const sortedPodcasts = podcastsWithDates
      .filter((p): p is typeof p & { lastEpisodeDate: Date } => p.lastEpisodeDate !== null)
      .sort((a, b) => b.lastEpisodeDate.getTime() - a.lastEpisodeDate.getTime());

    return NextResponse.json({ podcasts: sortedPodcasts });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search podcasts" },
      { status: 500 }
    );
  }
}
