import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchCandidatePool, toRestaurant, type PooledRestaurant, type RestaurantRow } from "@/lib/restaurants/pool";
import { enrichCandidates } from "@/lib/restaurants/enrich";
import { ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import {
  calculateGroupGenreScores,
  getGenreRanking,
  getSearchParams,
  resolveAreas,
  scoreAndRankRestaurants,
} from "@/lib/matching-engine";
import { mapProfileRow, mapSurveyResponseRow } from "@/lib/session-data";
import { recommendCandidateAreas } from "@/lib/recommendation/place";
import { AREA_CENTERS } from "@/lib/areas";
import {
  aggregateBudgetSignals,
  scoreRestaurantForSession,
} from "@/lib/recommendation/restaurants";
import type { CandidateArea } from "@/lib/recommendation/types";
import type {
  Restaurant,
  SessionAtmosphere,
  SessionFocus,
  UserProfile,
} from "@/lib/types";

type SortMode = "match" | "rating";

type CandidateAreaWithRestaurants = CandidateArea & {
  restaurants: Restaurant[];
};

// アレルギー・食事制限は安全のため「名前つきで幹事メモ」として共有する。
// (好みの回答は引き続き非公開。ユーザー決定 2026-07-05)
type DietaryNote = {
  memberName: string;
  labels: string[];
};

// 候補は HotPepper ではなく自前の台帳 + 信頼レイヤー (restaurants/pool) から出す。
// 既存のセッションスコアに信頼ブーストを加算し、優先枠 (メンバーのお気に入り)
// とバッジ ("〇〇のおすすめ！") を返す。
function rankAreaRestaurants(params: {
  area: CandidateArea;
  pooled: PooledRestaurant[];
  sortBy: SortMode;
  groupGenreScores: ReturnType<typeof calculateGroupGenreScores>;
  budgetSignals: ReturnType<typeof aggregateBudgetSignals>;
  sessionAtmosphere: SessionAtmosphere | null;
  sessionFocus: SessionFocus | null;
  groupSize: number;
}) {
  const {
    area,
    pooled,
    sortBy,
    groupGenreScores,
    budgetSignals,
    sessionAtmosphere,
    sessionFocus,
    groupSize,
  } = params;

  const trustByRestaurantId = new Map(
    pooled.map((entry) => [entry.restaurant.id, entry])
  );

  const ranked = scoreAndRankRestaurants(
    pooled.map((entry) => ({ ...entry.restaurant, area: area.areaName })),
    groupGenreScores,
    sortBy
  ).map((result) => {
    const sessionScore = scoreRestaurantForSession({
      restaurant: result.restaurant,
      baseMatch: result.matchScore,
      groupSize,
      sessionAtmosphere,
      sessionFocus,
      budgetSignals,
    });
    const trust = trustByRestaurantId.get(result.restaurant.id);

    const reasonTags = [...sessionScore.reasonTags];
    if (trust?.isMemberFavorite) reasonTags.unshift("メンバーのお気に入り");
    else if (trust?.endorsementLabel) reasonTags.unshift(trust.endorsementLabel);
    else if ((trust?.recommendedByNames ?? []).length > 0)
      reasonTags.unshift(`${trust?.recommendedByNames?.[0]}さんのお気に入り`);
    else if ((trust?.publicFavoriteCount ?? 0) > 0)
      reasonTags.unshift("みんなのお気に入り");

    return {
      ...result.restaurant,
      matchScore: Math.min(
        1,
        sessionScore.matchScore + (trust?.trustBoost ?? 0)
      ),
      rating: sessionScore.rating,
      reasonTags,
      reasonExplanation: sessionScore.reasonExplanation,
      genreScore: result.genreScore,
      isMemberFavorite: trust?.isMemberFavorite ?? false,
      endorsementLabel: trust?.endorsementLabel ?? null,
      publicFavoriteCount: trust?.publicFavoriteCount ?? 0,
      recommendedByNames: trust?.recommendedByNames ?? [],
      pr: trust?.pr ?? false,
      recommendationLabel:
        trust?.endorsementLabel ??
        ((trust?.recommendedByNames ?? []).length > 0
          ? `${trust?.recommendedByNames?.[0]}さんのお気に入り`
          : null),
      recommendedAt: trust?.latestSourceAt ?? null,
    };
  });

  return ranked.sort((a, b) => {
    // メンバーのお気に入りは優先枠として常に先頭側へ
    if (a.isMemberFavorite !== b.isMemberFavorite)
      return a.isMemberFavorite ? -1 : 1;
    return sortBy === "rating" ? b.rating - a.rating : b.matchScore - a.matchScore;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  const sortBy = (searchParams.get("sort") as SortMode) ?? "match";
  const shuffleSeed = Number(searchParams.get("seed")) || undefined;

  if (!groupId) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const [{ data: group, error: groupError }, { data: surveyRows, error: surveyError }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name, group_size, session_atmosphere, session_focus, scheduled_at")
        .eq("id", groupId)
        .single(),
      supabase
        .from("survey_responses")
        .select(`
          *,
          group_members!inner (
            id,
            display_name,
            profile_id
          )
        `)
        .eq("group_id", groupId),
    ]);

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 404 });
  }

  if (surveyError) {
    return NextResponse.json({ error: surveyError.message }, { status: 500 });
  }

  // アンケート0件でも「全部おまかせ」としてデフォルト提案を出す
  const surveys = ((surveyRows ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    mapSurveyResponseRow(row)
  );
  const surveyRowsWithMeta = ((surveyRows ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    survey: mapSurveyResponseRow(row),
    profileId: ((row.group_members as { profile_id?: string } | null)?.profile_id) ?? null,
  }));
  const profileIds = (surveyRows ?? [])
    .map((row) => (row.group_members as { profile_id?: string } | null)?.profile_id)
    .filter(Boolean) as string[];

  let profiles: UserProfile[] = [];
  if (profileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);
    profiles = (profileRows as unknown as Record<string, unknown>[]).map((row) =>
      mapProfileRow(row)
    );
  }

  const groupGenreScores = calculateGroupGenreScores(surveys, profiles);
  const genreRanking = getGenreRanking(groupGenreScores);
  const { genreCodes } = getSearchParams(
    genreRanking,
    3,
    (group.session_focus as SessionFocus | null) ?? null
  );
  const resolvedAreas = resolveAreas(surveys);
  const budgetSignals = aggregateBudgetSignals(
    surveys.map((survey) => ({
      idealYen: survey.budgetIdealYen ?? null,
      maxYen: survey.budgetMaxYen ?? null,
      priority: survey.budgetPriority ?? null,
    }))
  );

  const candidateAreas = recommendCandidateAreas({
    groupSize: (group.group_size as number | null) ?? (surveyRows?.length || 2),
    scheduledAt: (group.scheduled_at as string | null) ?? null,
    sessionAtmosphere: (group.session_atmosphere as SessionAtmosphere | null) ?? null,
    sessionFocus: (group.session_focus as SessionFocus | null) ?? null,
    responses: surveys.map((survey) => ({
      departureArea: survey.departureArea ?? null,
      departureStation: survey.departureStation ?? null,
      preferredAreas: survey.preferredAreas ?? [],
    })),
  });

  const fallbackAreas =
    candidateAreas.length > 0
      ? candidateAreas
      : resolvedAreas
          .map((areaName) =>
            recommendCandidateAreas({
              groupSize: (group.group_size as number | null) ?? (surveyRows?.length || 2),
              sessionAtmosphere: (group.session_atmosphere as SessionAtmosphere | null) ?? null,
              sessionFocus: (group.session_focus as SessionFocus | null) ?? null,
              scheduledAt: (group.scheduled_at as string | null) ?? null,
              responses: [{ preferredAreas: [areaName] }],
            }, 1)[0]
          )
          .filter(Boolean);

  let supportedAreas = fallbackAreas.filter(
    (area) => area.areaName in AREA_CENTERS
  );

  // 誰もエリア希望を出していない (全部スキップ) 場合は人気エリアで提案する
  if (supportedAreas.length === 0) {
    supportedAreas = recommendCandidateAreas({
      groupSize: (group.group_size as number | null) ?? (surveyRows?.length || 2),
      sessionAtmosphere: (group.session_atmosphere as SessionAtmosphere | null) ?? null,
      sessionFocus: (group.session_focus as SessionFocus | null) ?? null,
      scheduledAt: (group.scheduled_at as string | null) ?? null,
      responses: [{ preferredAreas: ["渋谷", "新宿", "恵比寿"] }],
    }, 3).filter((area) => area.areaName in AREA_CENTERS);
  }

  const memberProfileIds = profileIds;
  const pool = await fetchCandidatePool({
    areaNames: supportedAreas.map((area) => area.areaName),
    genreCodes,
    memberProfileIds,
    shuffleSeed,
    trustedOnly: true, // 台帳フィラーは廃止。候補は常に人間発
  });

  const areaGroups: CandidateAreaWithRestaurants[] = supportedAreas.map((area) => {
    const restaurants = rankAreaRestaurants({
      area,
      pooled: pool.get(area.areaName) ?? [],
      sortBy,
      groupGenreScores,
      budgetSignals,
      sessionAtmosphere: (group.session_atmosphere as SessionAtmosphere | null) ?? null,
      sessionFocus: (group.session_focus as SessionFocus | null) ?? null,
      groupSize: (group.group_size as number | null) ?? (surveyRows?.length || 2),
    });

    return {
      ...area,
      restaurants: restaurants.slice(0, 8),
    };
  });

  // ── 持ち寄り (メンバーがアンケートで挙げた店) を最優先候補に ──
  // 名前を出すことを許可した人がいれば「◯◯のおすすめ」、いなければ「メンバーのおすすめ」
  const suggestionLabel = new Map<string, string>();
  for (const { survey } of surveyRowsWithMeta) {
    for (const suggestion of survey.suggestedRestaurants ?? []) {
      const existing = suggestionLabel.get(suggestion.id);
      const label = suggestion.showName
        ? `${survey.memberName}のおすすめ`
        : "メンバーのおすすめ";
      // 実名ラベルを優先
      if (!existing || (existing === "メンバーのおすすめ" && suggestion.showName)) {
        suggestionLabel.set(suggestion.id, label);
      }
    }
  }

  let suggestedResults: (Restaurant & {
    reasonTags: string[];
    isSuggested: boolean;
  })[] = [];
  if (suggestionLabel.size > 0) {
    const { data: suggestedRows } = await supabase
      .from("restaurants")
      .select("*")
      .in("id", [...suggestionLabel.keys()])
      .eq("closed", false);
    suggestedResults = ((suggestedRows ?? []) as unknown as RestaurantRow[]).map(
      (row) => ({
        ...toRestaurant(row),
        matchScore: 0.95, // 持ち寄りは常に先頭
        rating: row.rating ?? 0,
        reasonTags: [suggestionLabel.get(row.id) ?? "メンバーのおすすめ"],
        recommendationLabel: suggestionLabel.get(row.id) ?? "メンバーのおすすめ",
        isSuggested: true,
      })
    );
  }

  const suggestedIds = new Set(suggestedResults.map((r) => r.id));
  for (const area of areaGroups) {
    area.restaurants = area.restaurants.filter((r) => !suggestedIds.has(r.id));
  }

  const flatResults = [
    ...suggestedResults,
    ...areaGroups.flatMap((area) => area.restaurants),
  ];

  // エンリッチメント: Places (閉業・評価・写真、店ごとに一度だけ) + HotPepper写真
  const closedIds = await enrichCandidates(supabase, flatResults, 12);
  if (closedIds.size > 0) {
    for (const area of areaGroups) {
      area.restaurants = area.restaurants.filter((r) => !closedIds.has(r.id));
    }
  }
  const visibleResults = flatResults.filter((r) => !closedIds.has(r.id));
  const restrictionLabels = new Map(
    [...ALLERGIES, ...DIETARY_RESTRICTIONS].map((item) => [item.id, item.name])
  );
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const dietaryNotes: DietaryNote[] = surveyRowsWithMeta
    .map(({ survey, profileId }) => {
      const profile = profileId ? profilesById.get(profileId) : null;
      const restrictionIds = [
        ...(profile?.allergies ?? []),
        ...((profile?.dietaryRestrictions ?? []).map(
          (restriction) => restriction.restrictionId
        ) ?? []),
        ...((survey.dietaryRestrictions ?? []).map(
          (restriction) => restriction.restrictionId
        ) ?? []),
      ];
      const noteLabels = [
        (profile?.allergyNote ?? "").trim(),
        (profile?.dietaryNote ?? "").trim(),
        ((survey as { allergyNote?: string | null }).allergyNote ?? "").trim(),
        ((survey as { dietaryNote?: string | null }).dietaryNote ?? "").trim(),
      ].filter(Boolean);
      const labels = [
        ...new Set([
          ...restrictionIds.map(
            (restrictionId) => restrictionLabels.get(restrictionId) ?? restrictionId
          ),
          ...noteLabels,
        ]),
      ].filter(Boolean);

      if (labels.length === 0) {
        return null;
      }

      return { memberName: survey.memberName, labels };
    })
    .filter((note): note is DietaryNote => note !== null);

  return NextResponse.json({
    groupName: group.name,
    groupGenreScores,
    genreRanking,
    resolvedAreas: areaGroups.map((area) => area.areaName),
    dietaryNotes,
    candidateAreas: areaGroups,
    results: visibleResults,
    totalRestaurants: visibleResults.length,
    fewCandidates: visibleResults.length < 5,
  });
}
