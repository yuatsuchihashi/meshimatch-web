// ============================================================
// MeshiMatch – ホーム用おすすめレストラン API
// ============================================================
// GET /api/recommendations?profile_id=xxx
// R2 以降は信頼リング由来の店だけを返す。台帳フィラーや外部検索補充はしない。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { EMPTY_CANDIDATE_POOL, fetchCandidatePool } from "@/lib/restaurants/pool";
import { mapProfileRow } from "@/lib/session-data";
import { SURVEY_AREAS } from "@/lib/areas";
import { stripInternalScore } from "@/lib/recommendation/ranking";

const FALLBACK_AREAS = ["渋谷", "恵比寿", "新宿"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profile_id");

  const supabase = await createServiceClient();
  let areas = FALLBACK_AREAS;
  let genreCodes: string[] = [];
  const memberProfileIds = profileId ? [profileId] : [];

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
        .filter((genre) => genre.priority !== "avoid")
        .map((genre) => genre.genreId);
    }
  }

  const pool = await fetchCandidatePool({
    genreCodes,
    memberProfileIds,
    areaNames: areas,
    maxPerArea: 12,
  });
  const all = [...pool.values()]
    .flat()
    .sort((a, b) => {
      if (a.ring !== b.ring) return a.ring - b.ring;
      return b.recommendationStrength - a.recommendationStrength;
    })
    .slice(0, 12);

  if (all.length === 0) {
    return NextResponse.json({
      candidatePool: EMPTY_CANDIDATE_POOL,
      recommendations: [],
    });
  }

  return NextResponse.json({
    candidatePool: { status: "ready", source: "trust_ring" },
    recommendations: all.map((entry) => {
      const restaurant = stripInternalScore(entry.restaurant);
      return {
        ...restaurant,
        isMemberFavorite: entry.isMemberFavorite,
        endorsementLabel: entry.endorsementLabel,
        publicFavoriteCount: entry.publicFavoriteCount,
        isCurated: entry.isCurated,
        pr: entry.pr,
        recommendedByNames: entry.recommendedByNames,
        officialRecommendedByNames: entry.officialRecommendedByNames,
        recommendationLabel:
          entry.contributorLabels[0] ??
          entry.endorsementLabel ??
          (entry.recommendedByNames[0]
            ? `${entry.recommendedByNames[0]}さんのお気に入り`
            : entry.officialRecommendedByNames[0]
              ? `${entry.officialRecommendedByNames[0]}公式のおすすめ`
              : null),
        recommendedAt: entry.latestSourceAt,
        reasonTags: [
          ...(entry.pr ? ["PR"] : []),
          ...(entry.contributorLabels[0] ? [entry.contributorLabels[0]] : []),
          ...(entry.sourceCount >= 2 ? ["複数人推し"] : []),
        ],
      };
    }),
  });
}
