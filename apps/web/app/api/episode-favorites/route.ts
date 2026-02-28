import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

interface ITunesPodcast {
  collectionName?: string;
  artistName?: string;
  description?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  primaryGenreName?: string;
}

function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

async function fetchPodcastFromiTunes(id: string): Promise<ITunesPodcast | null> {
  try {
    const response = await fetch(`https://itunes.apple.com/lookup?id=${id}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data?.results) || data.results.length === 0) return null;

    return data.results[0];
  } catch {
    return null;
  }
}

async function resolvePodcastId(serviceSupabase: ReturnType<typeof createServiceClient>, podcastId?: string) {
  if (!podcastId) return null;

  if (isUUID(podcastId)) {
    return podcastId;
  }

  const itunesId = Number.parseInt(podcastId, 10);
  if (Number.isNaN(itunesId)) {
    return null;
  }

  const { data: existingPodcast } = await serviceSupabase
    .from("pc_podcasts")
    .select("id")
    .eq("itunes_id", itunesId)
    .maybeSingle();

  if (existingPodcast?.id) {
    return existingPodcast.id as string;
  }

  const podcastInfo = await fetchPodcastFromiTunes(podcastId);
  const { data: newPodcast, error: createPodcastError } = await serviceSupabase
    .from("pc_podcasts")
    .insert({
      itunes_id: itunesId,
      title: podcastInfo?.collectionName || "Unknown Podcast",
      author: podcastInfo?.artistName || null,
      description: podcastInfo?.description || null,
      rss_url: podcastInfo?.feedUrl || null,
      artwork_url: podcastInfo?.artworkUrl600 || null,
      genre: podcastInfo?.primaryGenreName || null,
    })
    .select("id")
    .single();

  if (createPodcastError) {
    // Handle race condition when another request creates this podcast first.
    if (createPodcastError.code === "23505") {
      const { data: raceWinner } = await serviceSupabase
        .from("pc_podcasts")
        .select("id")
        .eq("itunes_id", itunesId)
        .maybeSingle();
      return (raceWinner?.id as string) || null;
    }
    throw createPodcastError;
  }

  return (newPodcast?.id as string) || null;
}

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const supabase = await createClient();
    const { data: favorites, error: dbError } = await supabase
      .from("pc_episode_favorites")
      .select(`
        id,
        created_at,
        episode:episode_id (
          id,
          guid,
          title,
          description,
          audio_url,
          duration,
          published_at,
          podcast:podcast_id (
            id,
            itunes_id,
            title,
            author,
            artwork_url
          )
        )
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      throw dbError;
    }

    // Transform snake_case to camelCase to match TypeScript types
    const transformedFavorites = favorites?.map((f: any) => ({
      id: f.id,
      userId: f.user_id,
      episodeId: f.episode_id,
      createdAt: f.created_at,
      episode: f.episode ? {
        id: f.episode.id,
        guid: f.episode.guid,
        title: f.episode.title,
        description: f.episode.description,
        audioUrl: f.episode.audio_url,
        duration: f.episode.duration,
        publishedAt: f.episode.published_at,
        podcastId: f.episode.podcast?.id,
        podcast: f.episode.podcast ? {
          id: f.episode.podcast.id,
          itunesId: f.episode.podcast.itunes_id,
          title: f.episode.podcast.title,
          author: f.episode.podcast.author,
          artworkUrl: f.episode.podcast.artwork_url,
        } : undefined,
      } : undefined,
    })) || [];

    return NextResponse.json({ favorites: transformedFavorites });
  } catch (error) {
    console.error("Fetch episode favorites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch episode favorites" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const supabase = await createClient();
    const serviceSupabase = createServiceClient();
    const { episodeId, guid, title, description, audioUrl, duration, publishedAt, podcastId } = await request.json();

    if (!episodeId && !guid) {
      return NextResponse.json(
        { error: "Episode ID or GUID is required" },
        { status: 400 }
      );
    }

    // Try to find episode by guid or id
    let episode: { id: string } | null = null;

    if (episodeId && isUUID(episodeId)) {
      // First try by UUID
      const { data: episodeById } = await supabase
        .from("pc_episodes")
        .select("id")
        .eq("id", episodeId)
        .maybeSingle();
      episode = episodeById;
    }

    // If not found, try by guid
    if (!episode && guid) {
      const { data: episodeByGuid } = await supabase
        .from("pc_episodes")
        .select("id")
        .eq("guid", guid)
        .maybeSingle();
      episode = episodeByGuid;
    }

    // If still not found, create the episode
    if (!episode && title) {
      const resolvedPodcastId = await resolvePodcastId(serviceSupabase, podcastId);

      const insertPayload: Record<string, unknown> = {
        guid,
        title,
        description,
        audio_url: audioUrl,
        duration,
        published_at: publishedAt,
      };
      if (resolvedPodcastId) {
        insertPayload.podcast_id = resolvedPodcastId;
      }

      const { data: newEpisode, error: createError } = await serviceSupabase
        .from("pc_episodes")
        .insert(insertPayload)
        .select("id")
        .single();

      if (createError) {
        // Handle race condition when another request creates this episode first.
        if (createError.code === "23505" && guid) {
          const { data: existingByGuid } = await supabase
            .from("pc_episodes")
            .select("id")
            .eq("guid", guid)
            .maybeSingle();
          if (existingByGuid) {
            episode = existingByGuid;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      } else {
        episode = newEpisode;
      }
    }

    if (!episode) {
      return NextResponse.json(
        { error: "Episode not found and could not be created" },
        { status: 404 }
      );
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from("pc_episode_favorites")
      .select("id")
      .eq("user_id", user!.id)
      .eq("episode_id", episode.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Already favorited" },
        { status: 409 }
      );
    }

    // Create favorite
    const { data: favorite, error: dbError } = await supabase
      .from("pc_episode_favorites")
      .insert({
        user_id: user!.id,
        episode_id: episode.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Add episode favorite DB error:", JSON.stringify(dbError));
      throw dbError;
    }

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error("Add episode favorite error:", JSON.stringify(error));
    return NextResponse.json(
      { error: "Failed to add episode favorite" },
      { status: 500 }
    );
  }
}
