"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isTestMode, getTestUser } from "@/lib/test-mode";
import { getApiUrl } from "@/lib/utils";

// Mock test user for frontend
const mockTestUser: User = {
  id: getTestUser().id,
  email: getTestUser().email,
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
  role: "authenticated",
  updated_at: new Date().toISOString(),
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    // Test mode: return mock user immediately
    if (isTestMode()) {
      console.log("[Test Mode] Using mock test user in useAuth hook");
      setUser(mockTestUser);
      setIsLoading(false);
      return;
    }

    // Check initial auth state
    const checkAuth = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        // Fallback to server auth endpoint when browser-to-Supabase fetch fails.
        try {
          const response = await fetch(getApiUrl("api/auth/user"), {
            cache: "no-store",
          });
          const data = await response.json().catch(() => ({ user: null }));
          if (isMounted) {
            setUser(data.user || null);
          }
        } catch {
          if (isMounted) {
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
