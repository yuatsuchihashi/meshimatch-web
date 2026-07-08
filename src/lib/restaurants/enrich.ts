// ============================================================
// 候補エンリッチメント – Google Places (call-once) + HotPepper 写真
// ============================================================
// 表示候補の上位について:
//   1. place_id 未取得の店 → Places を一度だけ呼び、
//      place_id / 閉業status / 評価 / 写真 を台帳に永続化
//      (閉業なら closed=true → 以後プールから消える)
//   2. それでも写真がない店 → HotPepper 照合で写真だけ補完
// 返り値は「今回のレスポンスから除外すべき閉業店の id 集合」。
// ============================================================

import { lookupPlace, placesEnabled } from "@/lib/google-places";
import { findHotpepperPhoto } from "@/lib/hotpepper/photo";
import type { Restaurant } from "@/lib/types";

type SupabaseLike = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => PromiseLike<unknown>;
    };
  };
};

export async function enrichCandidates(
  supabase: SupabaseLike,
  candidates: Restaurant[],
  limit = 12
): Promise<Set<string>> {
  const closedIds = new Set<string>();

  const targets = candidates
    .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
    .slice(0, limit);

  await Promise.all(
    targets.map(async (restaurant) => {
      // 1. Places (未取得の店だけ。一度呼んだら place_id が残り二度と呼ばない)
      if (placesEnabled() && !restaurant.placeId) {
        const hit = await lookupPlace({
          name: restaurant.name,
          lat: restaurant.lat!,
          lng: restaurant.lng!,
        });
        if (hit) {
          restaurant.placeId = hit.placeId;
          restaurant.googleRating = hit.rating;
          if (hit.photoUrl && !restaurant.photoUrl) {
            restaurant.photoUrl = hit.photoUrl;
          }
          if (hit.closed) closedIds.add(restaurant.id);
          await supabase
            .from("restaurants")
            .update({
              place_id: hit.placeId,
              rating: hit.rating,
              closed: hit.closed,
              ...(hit.photoUrl ? { photo_url: hit.photoUrl } : {}),
            })
            .eq("id", restaurant.id);
        }
      }

      // 2. HotPepper 写真フォールバック
      if (!restaurant.photoUrl) {
        const photo = await findHotpepperPhoto({
          name: restaurant.name,
          lat: restaurant.lat!,
          lng: restaurant.lng!,
        });
        if (photo) {
          restaurant.photoUrl = photo.photoUrl;
          await supabase
            .from("restaurants")
            .update({ photo_url: photo.photoUrl })
            .eq("id", restaurant.id);
        }
      }
    })
  );

  return closedIds;
}
