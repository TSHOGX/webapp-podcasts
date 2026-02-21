"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LoginPromptProps {
  title?: string;
  description?: string;
  returnUrl?: string;
}

export function LoginPrompt({
  title = "需要登录",
  description = "此功能需要登录后才能使用。登录后可以保存您的收藏、查看转录历史等功能。",
  returnUrl,
}: LoginPromptProps) {
  const pathname = usePathname();
  const redirectUrl = returnUrl || pathname;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-balance">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button asChild className="w-full">
          <Link href={`/login?returnUrl=${encodeURIComponent(redirectUrl)}`}>
            登录
          </Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link
            href={`/register?returnUrl=${encodeURIComponent(redirectUrl)}`}
            className="text-primary hover:underline"
          >
            立即注册
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
