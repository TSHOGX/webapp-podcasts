"use client";

import { SearchHero } from "@/components/podcast/search-hero";
import { UserHome } from "@/components/podcast/user-home";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Loader2 } from "lucide-react";

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <SearchHero />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <MainLayout>
      <UserHome userName={user?.user_metadata?.name || user?.email?.split("@")[0]} />
    </MainLayout>
  );
}
