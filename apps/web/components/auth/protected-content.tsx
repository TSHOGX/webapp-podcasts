"use client";

import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LoginPrompt } from "./login-prompt";
import { Loader2 } from "lucide-react";

interface ProtectedContentProps {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  description?: string;
  returnUrl?: string;
}

export function ProtectedContent({
  children,
  fallback,
  title,
  description,
  returnUrl,
}: ProtectedContentProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="py-12">
        <LoginPrompt
          title={title}
          description={description}
          returnUrl={returnUrl}
        />
      </div>
    );
  }

  return <>{children}</>;
}
