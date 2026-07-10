// ============================================================
// MeshiMatch – ホーム用おすすめレストラン API
// ============================================================
// GET /api/recommendations?profile_id=xxx
// 信頼レイヤー (公開お気に入り・キュレーション・推薦) から、
// ユーザーの「よく行く場所」を優先しておすすめを返す。
// グループ文脈なしの個人向けディスカバリー枠。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchCandidatePool,
  toRestaurant,
  type PooledRestaurant,
  type RestaurantRow,
  type SourceRow,
} from "@/lib/restaurants/pool";
import { enrichCandidates } from "@/lib/restaurants/enrich";
import { mapProfileRow } from "@/lib/session-data";
import { SURVEY_AREAS } from "@/lib/areas";

const FALLBACK_AREAS = ["渋谷", "恵比寿", "新宿"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profile_id");

  const supabase = await createServiceClient();

  // ユーザーの普段の設定 (よく行く場所・好きジャンル) を反映
  let areas = FALLBACK_AREAS;
  let genreCodes: string[] = [];
  let memberProfileIds: string[] = [];
  let followingIds: string[] = [];

  if (profileId) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single();
    if (profileRow) {
      const profile = mapProfileRow(profileRow as Record<string, unknown>);
      const usual = (profile.usualAreas ?? []).filter((area) =>
        (SURVEY_AREAS as readonly string[]).includes(area)
      );
      if (usual.length > 0) areas = usual;
      genreCodes = (profile.favoriteGenres ?? [])
        .filter((g) => g.priority !== "avoid")
        .map((g) => g.genreId);
      memberProfileIds = [profileId];
    }

    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", profileId);
    followingIds = [
      ...new Set(
        ((follows ?? []) as { following_id?: string | null }[])
          .map((follow) => follow.following_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
  }

  const pool = await fetchCandidatePool({
    areaNames: areas,
    genreCodes,
    memberProfileIds,
    maxPerArea: 12,
  });

  // 信頼付きの店を優先し、エリアを混ぜながら最大12件
  const all = [...pool.values()].flat();
  const trusted = all
    .filter((entry) => entry.trustBoost > 0)
    .sort((a, b) => b.trustBoost - a.trustBoost);
  const fill = all.filter((entry) => entry.trustBoost === 0);

  let connectionFavorites: PooledRestaurant[] = [];
  if (followingIds.length > 0) {
    const { data: sourceRows } = await supabase
      .from("restaurant_sources")
      .select("*")
      .eq("source_type", "user_favorite")
      .eq("visibility", "public")
      .in("added_by", followingIds)
      .order("created_at", { ascending: false })
      .limit(24);
    const sources = (sourceRows ?? []) as unknown as SourceRow[];
    const restaurantIds = [...new Set(sources.map((source) => source.restaurant_id))];
    const profileIds = [...new Set(sources.map((source) => source.added_by).filter(Boolean))] as string[];
    const profileNamesById = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", profileIds);
      for (const profile of (profileRows ?? []) as { id: string; display_name?: string | null }[]) {
        profileNamesById.set(profile.id, profile.display_name ?? "ユーザー");
      }
    }

    if (restaurantIds.length > 0) {
      const { data: restaurantRows } = await supabase
        .from("restaurants")
        .select("*")
        .in("id", restaurantIds)
        .in("nearest_area", areas)
        .eq("closed", false);
      const sourcesByRestaurant = new Map<string, SourceRow[]>();
      for (const source of sources) {
        sourcesByRestaurant.set(source.restaurant_id, [
          ...(sourcesByRestaurant.get(source.restaurant_id) ?? []),
          source,
        ]);
      }

      connectionFavorites = ((restaurantRows ?? []) as unknown as RestaurantRow[]).map((row) => {
        const relatedSources = sourcesByRestaurant.get(row.id) ?? [];
        const names = [
          ...new Set(
            relatedSources
              .map((source) => profileNamesById.get(source.added_by ?? "") ?? null)
              .filter((name): name is string => Boolean(name))
          ),
        ];
        const latestSourceAt =
          relatedSources
            .map((source) => source.created_at ?? null)
            .filter((createdAt): createdAt is string => Boolean(createdAt))
            .sort()
            .at(-1) ?? null;
        return {
          restaurant: {
            ...toRestaurant(row),
            recommendedByNames: names,
            recommendationLabel: names[0] ? `${names[0]}さんが最近追加` : "つながりの最近のお気に入り",
            recommendedAt: latestSourceAt,
          },
          trustBoost: 0.45,
          isMemberFavorite: false,
          endorsementLabel: null,
          publicFavoriteCount: names.length,
          isCurated: false,
          recommendedByNames: names,
          latestSourceAt,
          pr: relatedSources.some((source) => source.pr === true),
        };
      });
    }
  }

  const seen = new Set<string>();
  const picked = [...connectionFavorites, ...trusted, ...fill]
    .filter((entry) => {
      if (seen.has(entry.restaurant.id)) return false;
      seen.add(entry.restaurant.id);
      return true;
    })
    .slice(0, 12);

  // エンリッチメント: Places (閉業・評価・写真) + HotPepper写真フォールバック
  const closedIds = await enrichCandidates(
    supabase,
    picked.map((entry) => entry.restaurant),
    10
  );
  const visible = picked.filter((entry) => !closedIds.has(entry.restaurant.id));

  return NextResponse.json({
    recommendations: visible.map((entry) => ({
      ...entry.restaurant,
      isMemberFavorite: entry.isMemberFavorite,
      endorsementLabel: entry.endorsementLabel,
      publicFavoriteCount: entry.publicFavoriteCount,
      isCurated: entry.isCurated,
      pr: entry.pr,
      recommendedByNames: entry.restaurant.recommendedByNames ?? entry.recommendedByNames,
      recommendationLabel:
        entry.restaurant.recommendationLabel ??
        entry.endorsementLabel ??
        ((entry.recommendedByNames ?? []).length > 0
          ? `${entry.recommendedByNames[0]}さんのお気に入り`
          : null),
      recommendedAt: entry.restaurant.recommendedAt ?? entry.latestSourceAt,
    })),
  });
}
