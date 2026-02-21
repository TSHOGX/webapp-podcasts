import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

type ErrorResponseBody = {
  error: string;
  code?: string;
  hint?: string;
};

class TranscriptionRouteError extends Error {
  status: number;
  code?: string;
  hint?: string;

  constructor(status: number, message: string, code?: string, hint?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.name = "TranscriptionRouteError";
  }
}

type SupabaseLikeError = {
  message?: string;
  code?: string;
  status?: number;
};

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

function getMissingRequiredEnvVars(): string[] {
  const requiredVars = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const missingVars: string[] = requiredVars.filter((name) => !process.env[name]);

  if (!process.env.SUPABASE_SERVER_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missingVars.push("SUPABASE_SERVER_URL|NEXT_PUBLIC_SUPABASE_URL");
  }

  return missingVars;
}

function buildMissingEnvError(missingEnvVars: string[]): TranscriptionRouteError {
  const missingVarsText = missingEnvVars.join(", ");

  if (missingEnvVars.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return new TranscriptionRouteError(
      503,
      "Transcription service is not configured on the web server.",
      "MISSING_SUPABASE_SERVICE_ROLE_KEY",
      "Set SUPABASE_SERVICE_ROLE_KEY in the web runtime environment (server-only, no NEXT_PUBLIC_ prefix) and restart the web service."
    );
  }

  return new TranscriptionRouteError(
    503,
    `Missing required environment variables: ${missingVarsText}`,
    "MISSING_TRANSCRIBE_ENV",
    "Set SUPABASE_SERVER_URL (or NEXT_PUBLIC_SUPABASE_URL fallback) plus required keys in the web runtime environment, then restart the web service."
  );
}

function normalizeUnknownError(error: unknown): ErrorResponseBody {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const maybeError = error as { message: string; code?: string; hint?: string };
    return {
      error: maybeError.message,
      code: maybeError.code,
      hint: maybeError.hint,
    };
  }

  return { error: "Failed to start transcription" };
}

function getSupabaseHost(): string {
  const supabaseUrl = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "unknown";
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return "invalid-url";
  }
}

function getKeyPrefix(key: string | undefined): string {
  if (!key) return "unset";
  return `${key.slice(0, 12)}...`;
}

function asSupabaseLikeError(error: unknown): SupabaseLikeError | null {
  if (!error || typeof error !== "object") return null;
  const maybeError = error as SupabaseLikeError;
  if (!maybeError.message) return null;
  return maybeError;
}

function isRlsViolation(error: unknown): boolean {
  const supabaseError = asSupabaseLikeError(error);
  if (!supabaseError?.message) return false;

  const message = supabaseError.message.toLowerCase();
  return (
    supabaseError.code === "42501" ||
    message.includes("row-level security policy") ||
    message.includes("requires a valid bearer token") ||
    message.includes("invalid jwt") ||
    message.includes("permission denied")
  );
}

function buildInvalidServiceRoleError(details?: string): TranscriptionRouteError {
  return new TranscriptionRouteError(
    503,
    "Web service key is invalid for privileged Supabase writes.",
    "INVALID_SERVICE_ROLE_KEY",
    details
      ? `Ensure SUPABASE_SERVICE_ROLE_KEY matches SUPABASE_SERVER_URL (or NEXT_PUBLIC_SUPABASE_URL fallback) for the same project. Details: ${details}`
      : "Ensure SUPABASE_SERVICE_ROLE_KEY matches SUPABASE_SERVER_URL (or NEXT_PUBLIC_SUPABASE_URL fallback) for the same project, then restart the web service."
  );
}

export async function POST(request: Request) {
  try {
    const missingEnvVars = getMissingRequiredEnvVars();
    if (missingEnvVars.length > 0) {
      throw buildMissingEnvError(missingEnvVars);
    }

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
      .maybeSingle();

    if (episodeError) {
      throw episodeError;
    }

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
      throw new TranscriptionRouteError(
        502,
        `Transcription service error: ${response.status} - ${errorText}`,
        "TRANSCRIPTION_SERVICE_ERROR",
        "Check NEXT_PUBLIC_API_URL and ensure the Python transcription API is reachable."
      );
    }

    const data = await response.json();

    return NextResponse.json({
      transcriptionId: transcription.id,
      taskId: data.task_id,
      status: "pending",
      message: "Transcription started",
    });
  } catch (error) {
    const errorInfo = asSupabaseLikeError(error);
    console.error("Transcription error context:", {
      supabaseHost: getSupabaseHost(),
      serviceRoleKeyPrefix: getKeyPrefix(process.env.SUPABASE_SERVICE_ROLE_KEY),
      errorCode: errorInfo?.code,
      errorStatus: errorInfo?.status,
      errorMessage: errorInfo?.message || (error instanceof Error ? error.message : "unknown"),
    });

    if (isRlsViolation(error)) {
      const invalidKeyError = buildInvalidServiceRoleError(errorInfo?.message);
      return NextResponse.json(
        {
          error: invalidKeyError.message,
          code: invalidKeyError.code,
          hint: invalidKeyError.hint,
        },
        { status: invalidKeyError.status }
      );
    }

    console.error("Transcription error raw:", error);
    if (error instanceof TranscriptionRouteError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: error.status }
      );
    }

    const normalizedError = normalizeUnknownError(error);
    return NextResponse.json(
      normalizedError,
      { status: 500 }
    );
  }
}
