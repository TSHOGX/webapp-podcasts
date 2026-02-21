import { createClient, createClientWithUrl } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isTestMode, getTestUser, logTestMode } from "./test-mode";

export type AuthResult = {
  user: { id: string; email?: string } | null;
  error: NextResponse | null;
};

/**
 * Get the authenticated user from the current session.
 * Returns the user object if authenticated, or an error response if not.
 * In test mode, returns a mock test user without checking Supabase.
 */
export async function getAuthUser(): Promise<AuthResult> {
  // Test mode: return mock user
  if (isTestMode()) {
    logTestMode("Using test user for authentication");
    return {
      user: getTestUser(),
      error: null,
    };
  }

  // Use public URL for authentication to match the URL used during login
  // This is needed when the server URL differs from the public URL (e.g., local dev with cpolar tunnel)
  const supabase = await createClientWithUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email },
    error: null,
  };
}
