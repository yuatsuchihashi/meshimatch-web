// ============================================================
// Google Places (New) エンリッチメント – call-once 設計
// ============================================================
// 店ごとに一度だけ Text Search を呼び、結果を台帳にキャッシュする:
//   place_id      → 二度と呼ばないためのマーカー
//   businessStatus → CLOSED_PERMANENTLY なら closed=true (候補から消える)
//   rating        → 評価
//   photo         → 写真URL (media エンドポイントのリダイレクト先を保存。
//                    キーはサーバー内でのみ使い、クライアントに露出しない)
// キー未設定・未許可のときは静かに no-op。
// ============================================================

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export interface PlacesEnrichment {
  placeId: string;
  closed: boolean;
  rating: number | null;
  photoUrl: string | null;
}

export function placesEnabled(): boolean {
  return Boolean(API_KEY);
}

export async function lookupPlace(params: {
  name: string;
  lat: number;
  lng: number;
  radius?: number; // バイアス半径 (m)。既知座標の照合=300、全都検索=30000など
}): Promise<PlacesEnrichment | null> {
  if (!API_KEY) return null;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.businessStatus,places.rating,places.photos",
      },
      body: JSON.stringify({
        textQuery: params.name,
        locationBias: {
          circle: {
            center: { latitude: params.lat, longitude: params.lng },
            radius: params.radius ?? 300,
          },
        },
        languageCode: "ja",
        maxResultCount: 1,
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: {
        id: string;
        businessStatus?: string;
        rating?: number;
        photos?: { name: string }[];
      }[];
    };
    const place = json.places?.[0];
    if (!place) return null;

    // 写真: media エンドポイントのリダイレクト先 (lh3...) を保存する。
    // こうするとクライアントにAPIキーを渡さずに <img> で表示できる。
    let photoUrl: string | null = null;
    const photoName = place.photos?.[0]?.name;
    if (photoName) {
      try {
        const mediaRes = await fetch(
          `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${API_KEY}`,
          { redirect: "manual" }
        );
        photoUrl = mediaRes.headers.get("location");
      } catch {
        photoUrl = null;
      }
    }

    return {
      placeId: place.id,
      closed: place.businessStatus === "CLOSED_PERMANENTLY",
      rating: place.rating ?? null,
      photoUrl,
    };
  } catch {
    return null;
  }
}
