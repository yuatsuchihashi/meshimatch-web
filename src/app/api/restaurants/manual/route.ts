// ============================================================
// 店の手動追加 – 検索で見つからない店を名前だけで登録
// ============================================================
// POST { name } → 台帳に最小限の行を作って返す。
// Places が使えれば座標・写真の照合を一度だけ試みる (失敗しても登録は成立)。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { lookupPlace, placesEnabled } from "@/lib/google-places";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function POST(request: NextRequest) {
  const { name } = (await request.json()) as { name?: string };
  const trimmed = (name ?? "").trim().slice(0, 60);
  if (trimmed.length < 2) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Places でヒットすれば正式情報つきで登録 (東京バイアス)
  if (placesEnabled() && API_KEY) {
    const hit = await lookupPlace({ name: trimmed, lat: 35.67, lng: 139.72, radius: 30000 });
    if (hit && !hit.closed) {
      const { data } = await supabase
        .from("restaurants")
        .upsert(
          {
            name: trimmed,
            place_id: hit.placeId,
            rating: hit.rating,
            photo_url: hit.photoUrl,
            external_id: `place:${hit.placeId}`,
            lat: null,
            lng: null,
          },
          { onConflict: "external_id" }
        )
        .select()
        .single();
      if (data) {
        const row = data as { id: string; name: string; nearest_area: string | null };
        return NextResponse.json(
          { id: row.id, name: row.name, area: row.nearest_area },
          { status: 201 }
        );
      }
    }
  }

  // 完全手動 (名前だけ)
  const { data, error } = await supabase
    .from("restaurants")
    .insert({
      name: trimmed,
      lat: null,
      lng: null,
      external_id: `manual:${trimmed}-${Math.random().toString(36).slice(2, 8)}`,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "failed to add" }, { status: 500 });
  }
  const row = data as { id: string; name: string; nearest_area: string | null };
  return NextResponse.json(
    { id: row.id, name: row.name, area: row.nearest_area },
    { status: 201 }
  );
}
