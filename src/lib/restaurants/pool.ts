// ============================================================
// 候補プール – 信頼リングから候補レストランを引く
// ============================================================
// R2 契約:
//   Ring 0 = グループメンバー本人の公開/非公開お気に入り・推薦 + survey 行きたい店
//   Ring 1 = メンバーがフォローしている通常ユーザーの公開お気に入り
//   Ring 2 = メンバーがフォローしている認証公式アカウントの公開リスト
//   Ring 3 = なし。空なら空状態を返す。台帳・外部検索フィラーは使わない。
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
  catalog_source?: "catalog" | null;
}

export interface SourceRow {
  id: string;
  restaurant_id: string;
  source_type: "base_curated" | "endorsement" | "user_favorite" | "catalog";
  visibility: "public" | "private";
  added_by: string | null;
  display_label: string | null;
  created_at?: string | null;
  pr?: boolean | null;
}

export type TrustRing = 0 | 1 | 2;

export interface SurveySuggestionInput {
  restaurantId: string;
  label: string;
  recommenderName?: string | null;
  createdAt?: string | null;
  pr?: boolean;
}

export interface PoolContributor {
  source: SourceRow | null;
  ring: TrustRing;
  label: string;
  recommenderName: string | null;
  profileId: string | null;
  pr: boolean;
  createdAt: string | null;
}

export interface PooledRestaurant {
  restaurant: Restaurant;
  ring: TrustRing;
  recommendationStrength: number;
  sourceCount: number;
  trustBoost: number;
  isMemberFavorite: boolean;
  endorsementLabel: string | null;
  publicFavoriteCount: number;
  isCurated: false;
  recommendedByNames: string[];
  officialRecommendedByNames: string[];
  contributorLabels: string[];
  latestSourceAt: string | null;
  pr: boolean;
}

export const EMPTY_CANDIDATE_POOL = {
  status: "empty",
  reason: "no_trust_ring_candidates",
  prompt: "このグループのおすすめがまだ足りません。行きたい店を追加してください。",
} as const;

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

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function maxRingStrength(ring: TrustRing) {
  if (ring === 0) return 1;
  if (ring === 1) return 0.72;
  return 0.52;
}

function labelForSource(source: SourceRow, profileNamesById: Map<string, string>) {
  if (source.display_label) return source.display_label;
  const name = source.added_by ? profileNamesById.get(source.added_by) : null;
  if (source.source_type === "endorsement") {
    return name ? `${name}のおすすめ` : "公式のおすすめ";
  }
  return name ? `${name}さんのお気に入り` : "公開お気に入り";
}

export function composePool(params: {
  restaurants: RestaurantRow[];
  sources: SourceRow[];
  memberProfileIds: string[];
  profileNamesById?: Map<string, string>;
  followedProfileIds?: string[];
  verifiedOfficialProfileIds?: string[];
  surveySuggestions?: SurveySuggestionInput[];
}): PooledRestaurant[] {
  const {
    restaurants,
    sources,
    memberProfileIds,
    profileNamesById = new Map(),
    followedProfileIds = [],
    verifiedOfficialProfileIds = [],
    surveySuggestions = [],
  } = params;
  const memberIds = new Set(memberProfileIds);
  const followedIds = new Set(followedProfileIds);
  const officialIds = new Set(verifiedOfficialProfileIds);
  const contributorsByRestaurant = new Map<string, PoolContributor[]>();
  const addContributor = (restaurantId: string, contributor: PoolContributor) => {
    contributorsByRestaurant.set(restaurantId, [
      ...(contributorsByRestaurant.get(restaurantId) ?? []),
      contributor,
    ]);
  };

  for (const suggestion of surveySuggestions) {
    addContributor(suggestion.restaurantId, {
      source: null,
      ring: 0,
      label: suggestion.label,
      recommenderName: suggestion.recommenderName ?? null,
      profileId: null,
      pr: suggestion.pr === true,
      createdAt: suggestion.createdAt ?? null,
    });
  }

  for (const source of sources) {
    if (source.source_type === "catalog") continue;
    if (!source.added_by) continue;
    const isMember = memberIds.has(source.added_by);
    const isFollowed = followedIds.has(source.added_by);
    const isOfficial = officialIds.has(source.added_by);
    let ring: TrustRing | null = null;

    if (isMember) {
      ring = 0;
    } else if (
      isFollowed &&
      isOfficial &&
      source.visibility === "public" &&
      (source.source_type === "user_favorite" || source.source_type === "endorsement")
    ) {
      ring = 2;
    } else if (
      isFollowed &&
      !isOfficial &&
      source.visibility === "public" &&
      source.source_type === "user_favorite"
    ) {
      ring = 1;
    }

    if (ring === null) continue;

    const name = profileNamesById.get(source.added_by) ?? null;
    addContributor(source.restaurant_id, {
      source,
      ring,
      label: labelForSource(source, profileNamesById),
      recommenderName: name,
      profileId: source.added_by,
      pr: source.pr === true,
      createdAt: source.created_at ?? null,
    });
  }

  return restaurants
    .map((row) => {
      const contributors = contributorsByRestaurant.get(row.id) ?? [];
      if (contributors.length === 0) return null;

      const ring = Math.min(...contributors.map((c) => c.ring)) as TrustRing;
      const sourceCount = contributors.length;
      const recommendationStrength = Math.min(
        1.35,
        maxRingStrength(ring) + Math.min((sourceCount - 1) * 0.12, 0.35)
      );
      const ring0 = contributors.filter((c) => c.ring === 0);
      const ring1 = contributors.filter((c) => c.ring === 1);
      const ring2 = contributors.filter((c) => c.ring === 2);
      const recommendedByNames = uniq(
        [...ring0, ...ring1]
          .map((c) => c.recommenderName)
          .filter((name): name is string => Boolean(name))
      );
      const officialRecommendedByNames = uniq(
        ring2
          .map((c) => c.recommenderName)
          .filter((name): name is string => Boolean(name))
      );
      const latestSourceAt =
        contributors
          .map((c) => c.createdAt)
          .filter((createdAt): createdAt is string => Boolean(createdAt))
          .sort()
          .at(-1) ?? null;
      const endorsementLabel =
        contributors.find((c) => c.source?.source_type === "endorsement")?.label ?? null;

      return {
        restaurant: toRestaurant(row),
        ring,
        recommendationStrength,
        sourceCount,
        // Kept as an internal compatibility alias for callers/tests that still say trustBoost.
        trustBoost: recommendationStrength,
        isMemberFavorite: ring0.length > 0,
        endorsementLabel,
        publicFavoriteCount: ring1.length,
        isCurated: false as const,
        recommendedByNames,
        officialRecommendedByNames,
        contributorLabels: uniq(contributors.map((c) => c.label)),
        latestSourceAt,
        pr: contributors.some((c) => c.pr),
      };
    })
    .filter((entry): entry is PooledRestaurant => entry !== null)
    .sort((a, b) => {
      if (a.ring !== b.ring) return a.ring - b.ring;
      return b.recommendationStrength - a.recommendationStrength;
    });
}

export function computeTrust(params: {
  sources: SourceRow[];
  memberProfileIds: string[];
  profileNamesById?: Map<string, string>;
  followedProfileIds?: string[];
  verifiedOfficialProfileIds?: string[];
  surveySuggestions?: SurveySuggestionInput[];
}): Pick<
  PooledRestaurant,
  | "ring"
  | "recommendationStrength"
  | "sourceCount"
  | "trustBoost"
  | "isMemberFavorite"
  | "endorsementLabel"
  | "publicFavoriteCount"
  | "isCurated"
  | "recommendedByNames"
  | "officialRecommendedByNames"
  | "contributorLabels"
  | "latestSourceAt"
  | "pr"
> {
  const restaurantIds = uniq([
    ...params.sources.map((source) => source.restaurant_id),
    ...(params.surveySuggestions ?? []).map((suggestion) => suggestion.restaurantId),
  ]);
  const rows = restaurantIds.map((id) => ({
    id,
    name: id,
    name_en: null,
    lat: 0,
    lng: 0,
    nearest_area: null,
    genre_id: null,
    price_band: null,
    address: null,
    url: null,
    photo_url: null,
    closed: false,
  }));
  return (
    composePool({ restaurants: rows, ...params })[0] ?? {
      ring: 2,
      recommendationStrength: 0,
      sourceCount: 0,
      trustBoost: 0,
      isMemberFavorite: false,
      endorsementLabel: null,
      publicFavoriteCount: 0,
      isCurated: false,
      recommendedByNames: [],
      officialRecommendedByNames: [],
      contributorLabels: [],
      latestSourceAt: null,
      pr: false,
    }
  );
}

export async function fetchCandidatePool(params: {
  genreCodes: string[];
  memberProfileIds: string[];
  surveySuggestions?: SurveySuggestionInput[];
  areaNames?: string[];
  maxPerArea?: number;
  shuffleSeed?: number;
  trustedOnly?: boolean;
}): Promise<Map<string, PooledRestaurant[]>> {
  const {
    memberProfileIds,
    surveySuggestions = [],
    areaNames = [],
    maxPerArea = 40,
  } = params;
  const supabase = await createServiceClient();

  let followedProfileIds: string[] = [];
  if (memberProfileIds.length > 0) {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .in("follower_id", memberProfileIds);
    followedProfileIds = uniq(
      ((follows ?? []) as { following_id?: string | null }[])
        .map((follow) => follow.following_id)
        .filter((id): id is string => Boolean(id))
    );
  }

  let verifiedOfficialProfileIds: string[] = [];
  if (followedProfileIds.length > 0) {
    const { data: grants } = await supabase
      .from("official_verification_grants")
      .select("profile_id")
      .in("profile_id", followedProfileIds);
    verifiedOfficialProfileIds = uniq(
      ((grants ?? []) as { profile_id?: string | null }[])
        .map((grant) => grant.profile_id)
        .filter((id): id is string => Boolean(id))
    );
  }

  let sources: SourceRow[] = [];
  const contributorIds = uniq([...memberProfileIds, ...followedProfileIds]);
  if (contributorIds.length > 0) {
    const { data: sourceRows } = await supabase
      .from("restaurant_sources")
      .select("*")
      .in("added_by", contributorIds);
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

  const restaurantIds = uniq([
    ...sources.map((source) => source.restaurant_id),
    ...surveySuggestions.map((suggestion) => suggestion.restaurantId),
  ]);
  if (restaurantIds.length === 0) return new Map();

  const { data: restaurantRows } = await supabase
    .from("restaurants")
    .select("*")
    .in("id", restaurantIds)
    .eq("closed", false);
  const areaSet = new Set(areaNames);
  const restaurants = ((restaurantRows ?? []) as unknown as RestaurantRow[]).filter(
    (row) =>
      areaSet.size === 0 || row.nearest_area === null || areaSet.has(row.nearest_area)
  );
  const pooled = composePool({
    restaurants,
    sources,
    memberProfileIds,
    profileNamesById,
    followedProfileIds,
    verifiedOfficialProfileIds,
    surveySuggestions,
  });
  const byArea = new Map<string, PooledRestaurant[]>();

  for (const entry of pooled) {
    const areaName = entry.restaurant.area || "その他";
    byArea.set(areaName, [...(byArea.get(areaName) ?? []), entry]);
  }

  for (const [areaName, entries] of byArea) {
    byArea.set(areaName, entries.slice(0, maxPerArea));
  }

  return byArea;
}
