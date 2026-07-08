// ============================================================
// 店名オートコンプリート検索
// ============================================================
// 持ち寄り入力用。台帳3.5万店を辞書として即時マッチし、
// ヒットが薄ければ Google Places で補完 (見つけた店は台帳に追加
// されるので、次からは辞書ヒットになる)。
// GET /api/restaurants/search?q=<query>
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { placesEnabled } from "@/lib/google-places";
import { nearestSurveyArea } from "@/lib/areas";
import type { RestaurantRow } from "@/lib/restaurants/pool";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\s　]/g, "");
}

interface SearchHit {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  photoUrl: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("closed", false);
  const rows = (data ?? []) as unknown as RestaurantRow[];

  const nq = normalize(q);
  const hits: SearchHit[] = rows
    .filter(
      (row) =>
        normalize(row.name).includes(nq) ||
        (row.name_en ? normalize(row.name_en).includes(nq) : false)
    )
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.name,
      area: row.nearest_area,
      address: row.address,
      photoUrl: row.photo_url,
    }));

  // 辞書ヒットが薄い場合は Places で補完 (東京中心にバイアス)
  if (hits.length < 3 && q.length >= 3 && placesEnabled()) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY!,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus",
        },
        body: JSON.stringify({
          textQuery: q,
          locationBias: {
            circle: { center: { latitude: 35.67, longitude: 139.72 }, radius: 30000 },
          },
          includedType: "restaurant",
          languageCode: "ja",
          maxResultCount: 5,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          places?: {
            id: string;
            displayName: { text: string };
            formattedAddress?: string;
            location?: { latitude: number; longitude: number };
            businessStatus?: string;
          }[];
        };
        const known = new Set(hits.map((h) => normalize(h.name)));
        for (const place of json.places ?? []) {
          if (place.businessStatus === "CLOSED_PERMANENTLY") continue;
          if (known.has(normalize(place.displayName.text))) continue;
          if (!place.location) continue;

          // 台帳へ追加 (次回からは辞書ヒット)。既存なら place: 外部IDで冪等
          const externalId = `place:${place.id}`;
          const { data: created } = await supabase
            .from("restaurants")
            .upsert(
              {
                name: place.displayName.text,
                lat: place.location.latitude,
                lng: place.location.longitude,
                nearest_area: nearestSurveyArea(
                  place.location.latitude,
                  place.location.longitude
                ),
                address: place.formattedAddress ?? null,
                place_id: place.id,
                external_id: externalId,
              },
              { onConflict: "external_id" }
            )
            .select()
            .single();

          const row = created as unknown as RestaurantRow | null;
          if (row) {
            hits.push({
              id: row.id,
              name: row.name,
              area: row.nearest_area,
              address: row.address,
              photoUrl: row.photo_url,
            });
          }
        }
      }
    } catch {
      // Places 補完は失敗しても辞書ヒットだけ返す
    }
  }

  return NextResponse.json({ results: hits.slice(0, 8) });
}
