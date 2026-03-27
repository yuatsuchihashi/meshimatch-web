import { fetchGenres } from "@/lib/hotpepper/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const genres = await fetchGenres();
    return NextResponse.json({ genres });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ジャンル取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
