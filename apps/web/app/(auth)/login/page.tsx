"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const { toast } = useToast();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Logged in successfully!",
        });
        // Use router.push for smooth navigation, preserving state and cache
        router.push(returnUrl);
        router.refresh();
      }
    } catch (err) {
      // Fallback to server-side login when browser-to-Supabase requests fail.
      try {
        const response = await fetch(getApiUrl("api/auth/login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to login");
        }

        toast({
          title: "Success",
          description: "Logged in successfully!",
        });
        router.push(returnUrl);
        router.refresh();
      } catch (fallbackError) {
        console.error("Login error:", err);
        console.error("Login fallback error:", fallbackError);
        toast({
          title: "Error",
          description: fallbackError instanceof Error
            ? fallbackError.message
            : "Failed to connect to authentication service. Please try again later.",
          variant: "destructive",
        });
      }
    }

    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md rounded-3xl shadow-soft-lg border-0">
      <CardHeader className="space-y-2 text-center p-8 pb-4">
        <CardTitle className="font-display text-3xl font-bold">Welcome Back</CardTitle>
        <CardDescription className="text-base">
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <Button type="submit" className="w-full h-12 text-base rounded-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={`/register${returnUrl !== "/" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`} className="text-primary hover:underline font-medium">
            Register
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Suspense fallback={<Card className="w-full max-w-md p-6 rounded-3xl">Loading...</Card>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
