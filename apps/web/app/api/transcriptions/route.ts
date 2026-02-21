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
        error_message,
        created_at,
        completed_at,
        episode:episode_id (
          id,
          title,
          audio_url,
          duration,
          podcast:podcast_id (
            id,
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

    return NextResponse.json({ transcriptions: transcriptions || [] });
  } catch (error) {
    console.error("Fetch transcriptions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" },
      { status: 500 }
    );
  }
}
