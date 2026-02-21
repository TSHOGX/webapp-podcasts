import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const supabase = await createClient();
    const { data: favorites, error: dbError } = await supabase
      .from("pc_favorites")
      .select(`
        id,
        created_at,
        podcast:podcast_id (
          id,
          itunes_id,
          title,
          author,
          artwork_url,
          genre
        )
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      throw dbError;
    }

    // Transform snake_case to camelCase to match TypeScript types
    const transformedFavorites = favorites?.map((f: any) => ({
      ...f,
      podcast: f.podcast ? {
        ...f.podcast,
        itunesId: f.podcast.itunes_id,
        artworkUrl: f.podcast.artwork_url,
      } : null,
    })) || [];

    return NextResponse.json({ favorites: transformedFavorites });
  } catch (error) {
    console.error("Fetch favorites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const supabase = await createClient();
    const { podcastId, itunesId, title, author, description, rssUrl, artworkUrl, genre } = await request.json();

    // First, check if podcast exists in our database
    let { data: podcast } = await supabase
      .from("pc_podcasts")
      .select("id")
      .eq("itunes_id", itunesId)
      .single();

    if (!podcast) {
      // Create podcast record
      const { data: newPodcast, error: createError } = await supabase
        .from("pc_podcasts")
        .insert({
          itunes_id: itunesId,
          title,
          author,
          description,
          rss_url: rssUrl,
          artwork_url: artworkUrl,
          genre,
        })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }
      podcast = newPodcast;
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from("pc_favorites")
      .select("id")
      .eq("user_id", user!.id)
      .eq("podcast_id", podcast.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Already favorited" },
        { status: 409 }
      );
    }

    // Create favorite
    const { data: favorite, error: dbError } = await supabase
      .from("pc_favorites")
      .insert({
        user_id: user!.id,
        podcast_id: podcast.id,
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error("Add favorite error:", error);
    return NextResponse.json(
      { error: "Failed to add favorite" },
      { status: 500 }
    );
  }
}
