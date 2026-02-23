import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ transcriptionId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transcriptionId } = await params;

    // Forward to FastAPI backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";
    const response = await fetch(`${apiUrl}/ai/chats/${transcriptionId}`, {
      headers: {
        "x-user-id": user.id,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Get AI chats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
