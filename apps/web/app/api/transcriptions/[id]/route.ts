import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { isTestMode } from "@/lib/test-mode";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Local Supabase config for testing (bypasses RLS)
const TEST_SUPABASE_URL = process.env.SUPABASE_TEST_URL || "http://127.0.0.1:54321";
const TEST_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TEST_KEY || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

function getTestModeClient() {
  return createSupabaseClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { id } = await params;
    // Use local Supabase in test mode to bypass RLS
    const supabase = isTestMode() ? getTestModeClient() : await createClient();

    const { error: dbError } = await supabase
      .from("pc_transcriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", user!.id);

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transcription error:", error);
    return NextResponse.json(
      { error: "Failed to delete transcription" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { id } = await params;
    // Use local Supabase in test mode to bypass RLS
    const supabase = isTestMode() ? getTestModeClient() : await createClient();

    const { data: transcription, error: dbError } = await supabase
      .from("pc_transcriptions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single();

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error("Fetch transcription error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcription" },
      { status: 500 }
    );
  }
}
