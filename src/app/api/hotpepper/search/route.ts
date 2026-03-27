import { createClient } from "@/lib/supabase/server";
import { searchRestaurants } from "@/lib/hotpepper/client";
import type { HotPepperSearchParams } from "@/lib/hotpepper/types";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  const params: HotPepperSearchParams = {
    keyword: sp.get("keyword") ?? undefined,
    large_area: sp.get("large_area") ?? undefined,
    middle_area: sp.get("middle_area") ?? undefined,
    small_area: sp.get("small_area") ?? undefined,
    lat: sp.get("lat") ? Number(sp.get("lat")) : undefined,
    lng: sp.get("lng") ? Number(sp.get("lng")) : undefined,
    range: sp.get("range")
      ? (Number(sp.get("range")) as 1 | 2 | 3 | 4 | 5)
      : undefined,
    genre: sp.get("genre") ?? undefined,
    budget: sp.get("budget") ?? undefined,
    count: sp.get("count") ? Number(sp.get("count")) : 30,
    start: sp.get("start") ? Number(sp.get("start")) : 1,
    private_room: sp.get("private_room") === "1" ? 1 : undefined,
    free_drink: sp.get("free_drink") === "1" ? 1 : undefined,
    free_food: sp.get("free_food") === "1" ? 1 : undefined,
    lunch: sp.get("lunch") === "1" ? 1 : undefined,
    midnight: sp.get("midnight") === "1" ? 1 : undefined,
  };

  try {
    const result = await searchRestaurants(params);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "検索中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
