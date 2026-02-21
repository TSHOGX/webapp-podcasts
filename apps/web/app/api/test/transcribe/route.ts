import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { isTestMode, logTestMode } from "@/lib/test-mode";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Local Supabase config for testing (bypasses RLS)
const TEST_SUPABASE_URL = process.env.SUPABASE_TEST_URL || "http://127.0.0.1:54321";
const TEST_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TEST_KEY || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

// Hardcoded test podcast ID for local Supabase
const TEST_PODCAST_ID = "63a47b28-d63f-420f-8289-89dc7fac2fe1";

export async function POST(request: Request) {
  try {
    // Check test mode - reject if not in test mode
    if (!isTestMode()) {
      return NextResponse.json(
        { error: "Test mode is not enabled" },
        { status: 403 }
      );
    }

    logTestMode("Received test transcription request");

    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use local Supabase for testing (bypasses RLS)
    logTestMode(`Using local Supabase: ${TEST_SUPABASE_URL}`);
    const supabase = createSupabaseClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { audioUrl, episodeTitle, podcastName } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio URL is required" },
        { status: 400 }
      );
    }

    // Use hardcoded test podcast ID to avoid RLS issues
    logTestMode(`Using test podcast: ${TEST_PODCAST_ID}`);

    // Create episode record
    const { data: episode, error: episodeError } = await supabase
      .from("pc_episodes")
      .insert({
        podcast_id: TEST_PODCAST_ID,
        title: episodeTitle || "Test Episode",
        audio_url: audioUrl,
      })
      .select("id")
      .single();

    if (episodeError) {
      console.error("[Test Mode] Failed to create episode:", episodeError);
      throw episodeError;
    }

    logTestMode(`Created test episode: ${episode.id}`);

    // Create transcription record
    const { data: transcription, error: transcriptionError } = await supabase
      .from("pc_transcriptions")
      .insert({
        user_id: user.id,
        episode_id: episode.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (transcriptionError) {
      console.error("[Test Mode] Failed to create transcription:", transcriptionError);
      throw transcriptionError;
    }

    logTestMode(`Created transcription record: ${transcription.id}`);

    // Call FastAPI backend to start transcription
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";
    const response = await fetch(`${apiUrl}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        episode_id: episode.id,
        audio_url: audioUrl,
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Test Mode] Transcription service error:", response.status, errorText);
      throw new Error(`Transcription service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logTestMode(`Transcription started with task ID: ${data.task_id}`);

    return NextResponse.json({
      transcriptionId: transcription.id,
      taskId: data.task_id,
      episodeId: episode.id,
      status: "pending",
      message: "Test transcription started",
    });
  } catch (error) {
    console.error("[Test Mode] Transcription error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to start transcription";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
