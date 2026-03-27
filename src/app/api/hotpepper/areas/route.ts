import {
  fetchLargeAreas,
  fetchMiddleAreas,
  fetchSmallAreas,
} from "@/lib/hotpepper/client";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? "large";
  const parentCode = sp.get("parent_code") ?? "";

  try {
    let areas: { code: string; name: string }[] = [];

    if (type === "large") {
      areas = await fetchLargeAreas();
    } else if (type === "middle" && parentCode) {
      areas = await fetchMiddleAreas(parentCode);
    } else if (type === "small" && parentCode) {
      areas = await fetchSmallAreas(parentCode);
    }

    return NextResponse.json({ areas });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "エリア取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
