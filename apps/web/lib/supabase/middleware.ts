import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Base path from next.config.ts
const BASE_PATH = "/podcasts";

// Protected routes that require authentication (without basePath)
const protectedRoutes = ["/favorites", "/transcriptions"];

// Test mode check
const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
// Use public URL for session validation (needed when local server differs from public URL)
const supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function updateSession(request: NextRequest) {
  // Test mode: skip all auth checks
  if (isTestMode) {
    console.log("[Test Mode] Skipping authentication in middleware");
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabasePublicUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  // Important: getUser() will refresh the session if it has expired
  // Wrap in try-catch to handle Supabase connection errors
  let user = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (error) {
    authError = error;
    console.error("Supabase auth error:", error);
  }

  // Get pathname without basePath for route checking
  const { pathname } = request.nextUrl;
  const pathnameWithoutBase = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || "/"
    : pathname;

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutBase.startsWith(route)
  );

  // Check if this is the login page
  const isLoginPage = pathnameWithoutBase === "/login";

  // If Supabase is unavailable, allow access to avoid infinite redirects
  const allowOffline = authError !== null;

  // Redirect to login if user is not authenticated and trying to access protected route
  if (isProtectedRoute && !user && !allowOffline) {
    const loginUrl = new URL(`${BASE_PATH}/login`, request.url);
    loginUrl.searchParams.set("returnUrl", pathnameWithoutBase);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to home if already logged in and trying to access login page
  if (user && isLoginPage) {
    const homeUrl = new URL(BASE_PATH, request.url);
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
