import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { id } = await params;
    // Use local Supabase in test mode to bypass RLS
    const serviceSupabase = isTestMode() ? getTestModeClient() : createServiceClient();

    // Get the transcription to find the task_id
    const { data: transcription, error: fetchError } = await serviceSupabase
      .from("pc_transcriptions")
      .select("id, status, task_id, episode_id")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single();

    if (fetchError) {
      console.error("Failed to fetch transcription:", fetchError);
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 }
      );
    }

    // Check if transcription can be cancelled
    if (!["pending", "processing"].includes(transcription.status)) {
      return NextResponse.json(
        { error: `Cannot cancel transcription with status '${transcription.status}'` },
        { status: 400 }
      );
    }

    // If there's a task_id, try to cancel via FastAPI
    if (transcription.task_id) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";
        const response = await fetch(`${apiUrl}/transcribe/${transcription.task_id}/cancel`, {
          method: "POST",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("FastAPI cancel error:", response.status, errorData);
          // Continue anyway to update database status
        }
      } catch (e) {
        console.error("Failed to call FastAPI cancel:", e);
        // Continue anyway to update database status
      }
    }

    // Update database status to cancelled
    const { error: updateError } = await serviceSupabase
      .from("pc_transcriptions")
      .update({
        status: "cancelled",
        error_message: "Transcription cancelled by user",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update transcription status:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel transcription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transcription cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel transcription error:", error);
    return NextResponse.json(
      { error: "Failed to cancel transcription" },
      { status: 500 }
    );
  }
}
