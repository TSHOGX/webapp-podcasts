import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const supabase = await createClient();
    const { data: transcriptions, error: dbError } = await supabase
      .from("pc_transcriptions")
      .select(`
        id,
        status,
        text,
        segments,
        language,
        error_message,
        created_at,
        completed_at,
        task_id,
        episode:episode_id (
          id,
          guid,
          title,
          audio_url,
          duration,
          podcast:podcast_id (
            id,
            itunes_id,
            title,
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
    const transformedTranscriptions = transcriptions?.map((t: any) => ({
      ...t,
      taskId: t.task_id,
      episode: t.episode ? {
        ...t.episode,
        podcast: t.episode.podcast ? {
          ...t.episode.podcast,
          itunesId: t.episode.podcast.itunes_id,
          artworkUrl: t.episode.podcast.artwork_url,
        } : null,
      } : null,
    })) || [];

    return NextResponse.json({ transcriptions: transformedTranscriptions });
  } catch (error) {
    console.error("Fetch transcriptions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" },
      { status: 500 }
    );
  }
}
