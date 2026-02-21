import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// Check if a string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Fetch podcast info from iTunes
async function fetchPodcastFromiTunes(id: string) {
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

// Get or create podcast by iTunes ID
async function getOrCreatePodcast(supabase: SupabaseClient, itunesId: string, title?: string) {
  // Try to find existing podcast by itunes_id
  const { data: existingPodcast } = await supabase
    .from("pc_podcasts")
    .select("id")
    .eq("itunes_id", parseInt(itunesId))
    .single();

  if (existingPodcast) {
    return existingPodcast.id;
  }

  // Fetch podcast info from iTunes and create new record
  const podcastInfo = await fetchPodcastFromiTunes(itunesId);

  const { data: newPodcast, error } = await supabase
    .from("pc_podcasts")
    .insert({
      itunes_id: parseInt(itunesId),
      title: podcastInfo?.collectionName || title || "Unknown Podcast",
      author: podcastInfo?.artistName || null,
      description: podcastInfo?.description || null,
      rss_url: podcastInfo?.feedUrl || null,
      artwork_url: podcastInfo?.artworkUrl600 || null,
      genre: podcastInfo?.primaryGenreName || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create podcast:", error);
    return null;
  }

  return newPodcast.id;
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    // Use service client for write operations to bypass RLS
    const serviceSupabase = createServiceClient();

    const { episodeId, audioUrl, podcastId, episodeTitle } = await request.json();

    if (!episodeId || !audioUrl) {
      return NextResponse.json(
        { error: "Episode ID and audio URL are required" },
        { status: 400 }
      );
    }

    // Resolve podcast_id - convert iTunes ID to UUID if needed
    let resolvedPodcastId: string | null = null;
    if (podcastId) {
      if (isUUID(podcastId)) {
        resolvedPodcastId = podcastId;
      } else {
        // It's an iTunes ID, get or create the podcast record
        resolvedPodcastId = await getOrCreatePodcast(serviceSupabase, podcastId, episodeTitle);
      }
    }

    // Get or create episode record (use service client to bypass RLS)
    const { data: episode, error: episodeError } = await serviceSupabase
      .from("pc_episodes")
      .select("id")
      .eq("audio_url", audioUrl)
      .single();

    let episodeDbId = episode?.id;

    if (!episodeDbId) {
      // Create episode record
      const { data: newEpisode, error: createError } = await serviceSupabase
        .from("pc_episodes")
        .insert({
          podcast_id: resolvedPodcastId,
          title: episodeTitle || "Unknown Episode",
          audio_url: audioUrl,
        })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }
      episodeDbId = newEpisode.id;
    }

    // Check if transcription already exists
    const { data: existingTranscription } = await supabase
      .from("pc_transcriptions")
      .select("id, status, text")
      .eq("user_id", user.id)
      .eq("episode_id", episodeDbId)
      .single();

    if (existingTranscription && existingTranscription.status === "completed") {
      return NextResponse.json({
        transcriptionId: existingTranscription.id,
        status: "completed",
        message: "Transcription already exists",
        transcription: existingTranscription,
      });
    }

    if (existingTranscription && (existingTranscription.status === "pending" || existingTranscription.status === "processing")) {
      return NextResponse.json({
        transcriptionId: existingTranscription.id,
        status: existingTranscription.status,
        message: `Transcription is ${existingTranscription.status}`,
      });
    }

    // Create transcription record (use service client to bypass RLS)
    const { data: transcription, error: transcriptionError } = await serviceSupabase
      .from("pc_transcriptions")
      .insert({
        user_id: user.id,
        episode_id: episodeDbId,
        status: "pending",
      })
      .select("id")
      .single();

    if (transcriptionError) {
      throw transcriptionError;
    }

    // Call FastAPI backend to start transcription
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";
    const response = await fetch(`${apiUrl}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        episode_id: episodeDbId,
        audio_url: audioUrl,
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Transcription service error:", response.status, errorText);
      throw new Error(`Transcription service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      transcriptionId: transcription.id,
      taskId: data.task_id,
      status: "pending",
      message: "Transcription started",
    });
  } catch (error) {
    console.error("Transcription error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to start transcription";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
