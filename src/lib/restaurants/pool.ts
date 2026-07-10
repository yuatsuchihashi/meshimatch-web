// ============================================================
// 候補プール – 台帳 + 信頼レイヤーから候補レストランを引く
// ============================================================
// 方針 (HotPepper 依存からの脱却):
//   デフォルトの母集団 = 信頼レイヤーが付いた店 (base_curated / endorsement /
//   public な user_favorite)。グループメンバー本人のお気に入りは最優先。
//   信頼付きの店がエリアに少ない間は台帳 (gazetteer) で補完する。
//
// 階層ブースト:
//   member_favorite   +0.35  グループメンバー本人のお気に入り (優先枠)
//   endorsement       +0.15  許可済み発信者の推薦 ("〇〇のおすすめ！" バッジ)
//   public_favorites  +0.05×人数 (上限 +0.15)  他ユーザーの公開お気に入り
//   base_curated      +0.10  初期キュレーション
//   gazetteer のみ     +0.00  補完枠
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import type { Restaurant, RestaurantMetadataSource } from "@/lib/types";

export interface RestaurantRow {
  id: string;
  name: string;
  name_en: string | null;
  lat: number;
  lng: number;
  nearest_area: string | null;
  genre_id: string | null;
  price_band: string | null;
  address: string | null;
  url: string | null;
  photo_url: string | null;
  closed: boolean;
  place_id?: string | null;
  rating?: number | null;
  opening_hours?: Record<string, unknown> | null;
  opening_hours_source?: RestaurantMetadataSource | null;
  opening_hours_updated_at?: string | null;
}

export interface SourceRow {
  id: string;
  restaurant_id: string;
  source_type: "base_curated" | "endorsement" | "user_favorite";
  visibility: "public" | "private";
  added_by: string | null;
  display_label: string | null;
  created_at?: string | null;
  pr?: boolean | null;
}

export interface PooledRestaurant {
  restaurant: Restaurant;
  trustBoost: number;
  isMemberFavorite: boolean;
  endorsementLabel: string | null;
  publicFavoriteCount: number;
  isCurated: boolean;
  recommendedByNames: string[];
  latestSourceAt: string | null;
  pr: boolean;
}

export function toRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    genre: "",
    genreId: row.genre_id ?? "",
    budget: row.price_band ?? "",
    photoUrl: row.photo_url ?? undefined,
    matchScore: 0,
    rating: 0,
    access: row.address ?? "",
    hotpepperUrl: row.url ?? undefined,
    hasPrivateRoom: false,
    address: row.address ?? "",
    area: row.nearest_area ?? "",
    lat: row.lat,
    lng: row.lng,
    placeId: row.place_id ?? null,
    googleRating: row.rating ?? null,
    openingHours: row.opening_hours ?? null,
    openingHoursSource: row.opening_hours_source ?? null,
    openingHoursUpdatedAt: row.opening_hours_updated_at ?? null,
  };
}

export function computeTrust(params: {
  sources: SourceRow[];
  memberProfileIds: string[];
  profileNamesById?: Map<string, string>;
}): Pick<
  PooledRestaurant,
  | "trustBoost"
  | "isMemberFavorite"
  | "endorsementLabel"
  | "publicFavoriteCount"
  | "isCurated"
  | "recommendedByNames"
  | "latestSourceAt"
  | "pr"
> {
  const { sources, memberProfileIds, profileNamesById = new Map() } = params;
  const memberIds = new Set(memberProfileIds);

  const isMemberFavorite = sources.some(
    (s) =>
      s.source_type === "user_favorite" &&
      s.added_by !== null &&
      memberIds.has(s.added_by)
  );
  const endorsement = sources.find(
    (s) => s.source_type === "endorsement" && s.visibility === "public"
  );
  const publicFavoriteCount = sources.filter(
    (s) =>
      s.source_type === "user_favorite" &&
      s.visibility === "public" &&
      (s.added_by === null || !memberIds.has(s.added_by))
  ).length;
  const recommendedByNames = [
    ...new Set(
      sources
        .filter(
          (s) =>
            s.source_type === "user_favorite" &&
            s.visibility === "public" &&
            s.added_by !== null
        )
        .map((s) => profileNamesById.get(s.added_by ?? "") ?? null)
        .filter((name): name is string => Boolean(name))
    ),
  ];
  const latestSourceAt =
    sources
      .map((source) => source.created_at ?? null)
      .filter((createdAt): createdAt is string => Boolean(createdAt))
      .sort()
      .at(-1) ?? null;
  const isCurated = sources.some((s) => s.source_type === "base_curated");
  const pr = sources.some((s) => s.pr === true);

  const trustBoost =
    (isMemberFavorite ? 0.35 : 0) +
    (endorsement ? 0.15 : 0) +
    Math.min(publicFavoriteCount * 0.05, 0.15) +
    (isCurated ? 0.1 : 0);

  return {
    trustBoost,
    isMemberFavorite,
    endorsementLabel: endorsement?.display_label ?? null,
    publicFavoriteCount,
    isCurated,
    recommendedByNames,
    latestSourceAt,
    pr,
  };
}

// シード付きの決定的ハッシュ (再検索シャッフル用)
function seededScore(id: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return hash;
}

export async function fetchCandidatePool(params: {
  areaNames: string[];
  genreCodes: string[];
  memberProfileIds: string[];
  maxPerArea?: number;
  shuffleSeed?: number;
  trustedOnly?: boolean; // 台帳フィラーを使わない (持ち寄り方式)
}): Promise<Map<string, PooledRestaurant[]>> {
  const { areaNames, genreCodes, memberProfileIds, maxPerArea = 40, shuffleSeed, trustedOnly } = params;
  const supabase = await createServiceClient();

  const { data: restaurantRows } = await supabase
    .from("restaurants")
    .select("*")
    .in("nearest_area", areaNames)
    .eq("closed", false);

  const restaurants = (restaurantRows ?? []) as unknown as RestaurantRow[];
  const ids = restaurants.map((r) => r.id);

  let sources: SourceRow[] = [];
  if (ids.length > 0) {
    const { data: sourceRows } = await supabase
      .from("restaurant_sources")
      .select("*")
      .in("restaurant_id", ids);
    sources = (sourceRows ?? []) as unknown as SourceRow[];
  }

  const addedByIds = [
    ...new Set(
      sources
        .map((source) => source.added_by)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const profileNamesById = new Map<string, string>();
  if (addedByIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", addedByIds);
    for (const profile of (profileRows ?? []) as { id: string; display_name?: string | null }[]) {
      profileNamesById.set(profile.id, profile.display_name ?? "ユーザー");
    }
  }

  const sourcesByRestaurant = new Map<string, SourceRow[]>();
  for (const source of sources) {
    // private なお気に入りは本人がグループにいる時だけ効かせる
    if (
      source.source_type === "user_favorite" &&
      source.visibility === "private" &&
      (source.added_by === null || !memberProfileIds.includes(source.added_by))
    ) {
      continue;
    }
    const list = sourcesByRestaurant.get(source.restaurant_id) ?? [];
    list.push(source);
    sourcesByRestaurant.set(source.restaurant_id, list);
  }

  const genreSet = new Set(genreCodes);
  const byArea = new Map<string, PooledRestaurant[]>();

  for (const areaName of areaNames) {
    const areaRestaurants = restaurants.filter((r) => r.nearest_area === areaName);

    const pooled = areaRestaurants.map((row) => {
      const trust = computeTrust({
        sources: sourcesByRestaurant.get(row.id) ?? [],
        memberProfileIds,
        profileNamesById,
      });
      return { restaurant: toRestaurant(row), ...trust };
    });

    // 選抜: 信頼付き (ジャンル不問) を先に、残りをジャンル一致の台帳で補完
    const trusted = pooled
      .filter((p) => p.trustBoost > 0)
      .sort((a, b) => b.trustBoost - a.trustBoost);
    const gazetteerMatch = pooled.filter(
      (p) =>
        p.trustBoost === 0 &&
        (genreSet.size === 0 || genreSet.has(p.restaurant.genreId))
    );
    // 台帳補完の並び: シードがあれば再検索ごとに違う顔ぶれ、なければ決定的
    if (shuffleSeed) {
      gazetteerMatch.sort(
        (a, b) => seededScore(a.restaurant.id, shuffleSeed) - seededScore(b.restaurant.id, shuffleSeed)
      );
    } else {
      gazetteerMatch.sort((a, b) => a.restaurant.id.localeCompare(b.restaurant.id));
    }

    byArea.set(
      areaName,
      (trustedOnly ? trusted : [...trusted, ...gazetteerMatch]).slice(0, maxPerArea)
    );
  }

  return byArea;
}
