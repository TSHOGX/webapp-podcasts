"use client";

import { useRouter } from "next/navigation";
import { LogOut, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeSelector } from "@/components/theme-selector";
import { createClient } from "@/lib/supabase/client";
import { getApiUrl } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      await fetch(getApiUrl("api/auth/logout"), { method: "POST" });
    }
    router.push("/login");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your preferences and account</p>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Sign out of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
