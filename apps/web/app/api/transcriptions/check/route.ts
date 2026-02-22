import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio URL is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First, find the episode by audio_url
    const { data: episode, error: episodeError } = await supabase
      .from("pc_episodes")
      .select("id")
      .eq("audio_url", audioUrl)
      .maybeSingle();

    if (episodeError || !episode) {
      // Episode doesn't exist yet, so no transcription exists
      return NextResponse.json({ transcription: null });
    }

    // Check if transcription exists for this episode
    const { data: transcription, error: transcriptionError } = await supabase
      .from("pc_transcriptions")
      .select("*, segments, language")
      .eq("user_id", user.id)
      .eq("episode_id", episode.id)
      .maybeSingle();

    if (transcriptionError || !transcription) {
      // No transcription exists
      return NextResponse.json({ transcription: null });
    }

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error("Check transcription error:", error);
    return NextResponse.json(
      { error: "Failed to check transcription status" },
      { status: 500 }
    );
  }
}
