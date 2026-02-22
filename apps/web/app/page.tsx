"use client";

import { SearchHero } from "@/components/podcast/search-hero";
import { UserHome } from "@/components/podcast/user-home";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {isAuthenticated ? (
        <UserHome userName={user?.user_metadata?.name || user?.email?.split("@")[0]} />
      ) : (
        <div className="py-8">
          <SearchHero />
        </div>
      )}
    </div>
  );
}
