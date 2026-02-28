import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createClient();

    const { error: dbError } = await supabase
      .from("pc_episode_favorites")
      .delete()
      .eq("id", id)
      .eq("user_id", user!.id);

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete episode favorite error:", error);
    return NextResponse.json(
      { error: "Failed to delete episode favorite" },
      { status: 500 }
    );
  }
}
