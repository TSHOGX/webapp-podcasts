import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

const API_TIMEOUT = 5000; // 5 seconds timeout

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Forward to FastAPI backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";

    try {
      const response = await fetchWithTimeout(
        `${apiUrl}/ai/settings`,
        {
          headers: {
            "x-user-id": user.id,
          },
        },
        API_TIMEOUT
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("FastAPI error:", response.status, errorText);
        return NextResponse.json(
          { error: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      // Return default settings if backend is unavailable
      return NextResponse.json({
        llm_provider: "kimi",
        llm_api_key: "",
        llm_base_url: null,
        llm_model: "kimi-latest",
        system_prompt: "你是一个专业的播客内容分析师，擅长从转录文本中提取关键信息并生成结构化的内容总结。",
        user_prompt_template: "请根据以下播客转录文本，生成一份结构化的内容总结：\n\n{{transcription}}\n\n请包含以下部分：\n1. 核心观点概述\n2. 关键话题与讨论要点\n3. 重要引用或案例\n4. 结论与启发",
        temperature: 0.7,
        enable_auto_summary: true,
      });
    }
  } catch (error) {
    console.error("Get AI settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Forward to FastAPI backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";

    try {
      const response = await fetchWithTimeout(
        `${apiUrl}/ai/settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id,
          },
          body: JSON.stringify(body),
        },
        API_TIMEOUT
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("FastAPI error:", response.status, errorText);
        return NextResponse.json(
          { error: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Backend unavailable. Please check if the API server is running." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Update AI settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
