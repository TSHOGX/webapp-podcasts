# Supabase Auth 配置与部署指南 (Podcasts 项目)

> 本文档记录 podcasts 项目的真实配置，供其他项目复用。

---

## 1. 项目架构

```
podcasts/                          # 项目根目录
├── apps/web/                      # Next.js 应用
│   ├── .env.local                 # 环境变量 (真实配置见下文)
│   ├── next.config.ts             # Next.js 配置
│   ├── app/(auth)/login/page.tsx  # 登录页面
│   ├── app/(auth)/register/page.tsx # 注册页面
│   └── lib/supabase/
│       ├── middleware.ts          # 认证中间件
│       └── client.ts              # 浏览器客户端
├── package.json                   # yarn + turbo monorepo
```

---

## 2. 环境变量 (真实配置)

**文件**: `apps/web/.env.local`

```bash
# Supabase 生产环境配置 (cpolar 公网 URL)
NEXT_PUBLIC_SUPABASE_URL=https://9878u908901829.vip.cpolar.cn
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# 后端 API 服务地址
NEXT_PUBLIC_API_URL=http://127.0.0.1:12890

# 应用基础路径 (用于部署在子路径)
NEXT_PUBLIC_BASE_PATH=/podcasts
```

---

## 3. Next.js 配置

**文件**: `apps/web/next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',           # 独立部署模式
  basePath: '/podcasts',          # 必须与 NEXT_PUBLIC_BASE_PATH 一致
  assetPrefix: '/podcasts',       # 静态资源前缀
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
```

---

## 4. Supabase 中间件 (完整代码)

**文件**: `apps/web/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 基础路径 - 与 next.config.ts 中的 basePath 保持一致
const BASE_PATH = "/podcasts";

// 受保护路由列表 (无需包含 basePath)
const protectedRoutes = ["/favorites", "/transcriptions"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  // 关键：使用 try-catch 处理 Supabase 连接错误
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

  // 获取路径 (去除 basePath)
  const { pathname } = request.nextUrl;
  const pathnameWithoutBase = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || "/"
    : pathname;

  // 判断当前路径类型
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutBase.startsWith(route)
  );
  const isLoginPage = pathnameWithoutBase === "/login";

  // 离线模式：Supabase 不可用时避免循环跳转
  const allowOffline = authError !== null;

  // 规则 1：未登录访问受保护路由 -> 跳转登录页
  if (isProtectedRoute && !user && !allowOffline) {
    const loginUrl = new URL(`${BASE_PATH}/login`, request.url);
    loginUrl.searchParams.set("returnUrl", pathnameWithoutBase);
    return NextResponse.redirect(loginUrl);
  }

  // 规则 2：已登录访问登录页 -> 跳转首页
  if (user && isLoginPage) {
    const homeUrl = new URL(BASE_PATH, request.url);
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
```

---

## 5. 浏览器客户端

**文件**: `apps/web/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

## 6. 登录页面 (完整代码)

**文件**: `apps/web/app/(auth)/login/page.tsx`

```typescript
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

const BASE_PATH = "/podcasts";

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

    // 表单验证
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

    // 登录逻辑 + 错误处理
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
        // 使用 router.push 实现平滑导航
        router.push(returnUrl);
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      toast({
        title: "Error",
        description: err instanceof Error
          ? `Network error: ${err.message}. Please check your connection or Supabase configuration.`
          : "Failed to connect to authentication service. Please try again later.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Login</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Don't have an account?{" "}
          <Link href={`${BASE_PATH}/register${returnUrl !== "/" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`} className="text-primary hover:underline">
            Register
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Suspense fallback={<Card className="w-full max-w-md p-6">Loading...</Card>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
```

---

## 7. 注册页面 (完整代码)

**文件**: `apps/web/app/(auth)/register/page.tsx`

```typescript
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

const BASE_PATH = "/podcasts";

function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const { toast } = useToast();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 表单验证
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // 注册逻辑 + 错误处理
    try {
      const { error } = await supabase.auth.signUp({
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
          description: "Account created! Please check your email to verify.",
        });
        router.push(`${BASE_PATH}/login${returnUrl !== "/" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`);
      }
    } catch (err) {
      console.error("Registration error:", err);
      toast({
        title: "Error",
        description: err instanceof Error
          ? `Network error: ${err.message}. Please check your connection or Supabase configuration.`
          : "Failed to connect to authentication service. Please try again later.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <CardDescription>
          Enter your details to create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href={`${BASE_PATH}/login${returnUrl !== "/" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`} className="text-primary hover:underline">
            Login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Suspense fallback={<Card className="w-full max-w-md p-6">Loading...</Card>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
```

---

## 8. 复用清单 (新项目快速配置)

### 步骤 1: 安装依赖

```bash
yarn add @supabase/ssr @supabase/supabase-js
```

### 步骤 2: 复制配置文件

| 文件 | 路径 | 需修改处 |
|------|------|----------|
| `.env.local` | `apps/web/.env.local` | Supabase URL、Anon Key、API URL、Base Path |
| `next.config.ts` | `apps/web/next.config.ts` | `basePath`, `assetPrefix` |
| `middleware.ts` | `apps/web/lib/supabase/middleware.ts` | `BASE_PATH`, `protectedRoutes` |
| `client.ts` | `apps/web/lib/supabase/client.ts` | 无需修改 |
| `login/page.tsx` | `apps/web/app/(auth)/login/page.tsx` | `BASE_PATH` |
| `register/page.tsx` | `apps/web/app/(auth)/register/page.tsx` | `BASE_PATH` |

### 步骤 3: 修改为自己的配置

```typescript
// 必须一致的三处 basePath
// 1. next.config.ts
const nextConfig = { basePath: '/your-app', assetPrefix: '/your-app' }

// 2. middleware.ts
const BASE_PATH = "/your-app";

// 3. login/page.tsx & register/page.tsx
const BASE_PATH = "/your-app";
```

### 步骤 4: 配置环境变量

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:your-port
NEXT_PUBLIC_BASE_PATH=/your-app
```

---

## 9. 关键要点总结

| 要点 | 说明 |
|------|------|
| **环境变量** | 生产环境使用公网 URL (`https://9878u908901829.vip.cpolar.cn`) |
| **中间件 try-catch** | 必须包裹 `supabase.auth.getUser()`，防止服务不可用时崩溃 |
| **allowOffline** | `authError !== null` 时允许访问，避免循环跳转 |
| **basePath 一致性** | `next.config.ts`、中间件、页面组件三处必须一致 |
| **网络错误捕获** | 登录/注册必须用 try-catch 包裹，提供友好错误提示 |
| **returnUrl** | 登录成功后返回原页面，提升用户体验 |
| **router.refresh()** | 登录成功后刷新服务端组件数据 |

---

## 10. 常见问题排查

### "Error failed to fetch"
- 检查 `NEXT_PUBLIC_SUPABASE_URL` 是否为正确的公网地址
- 检查网络连接和 Supabase 服务状态
- 查看浏览器控制台网络请求详情

### 无限重定向
- 确保中间件有 `allowOffline` 逻辑
- 检查 `BASE_PATH` 配置是否一致
- 确认受保护路由配置无误

### 部署后样式丢失
- 确保 `next.config.ts` 中设置了 `assetPrefix`
- 确保 `BASE_PATH` 与部署路径一致
