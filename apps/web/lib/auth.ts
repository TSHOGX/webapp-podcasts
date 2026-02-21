import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

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
