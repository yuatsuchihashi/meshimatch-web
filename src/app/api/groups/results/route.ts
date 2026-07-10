import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  EMPTY_CANDIDATE_POOL,
  fetchCandidatePool,
  type SurveySuggestionInput,
} from "@/lib/restaurants/pool";
import { ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import {
  calculateGroupGenreScores,
  getGenreRanking,
  getSearchParams,
} from "@/lib/matching-engine";
import { mapProfileRow, mapSurveyResponseRow } from "@/lib/session-data";
import { recommendCandidateAreas } from "@/lib/recommendation/place";
import { findAreaMetadataByName } from "@/lib/recommendation/areas";
import { aggregateBudgetSignals } from "@/lib/recommendation/restaurants";
import {
  rankCandidatePool,
  stripInternalScore,
  type RankedRestaurant,
} from "@/lib/recommendation/ranking";
import type { CandidateArea } from "@/lib/recommendation/types";
import type {
  GroupMode,
  SessionAtmosphere,
  SessionFocus,
  UserProfile,
} from "@/lib/types";

type CandidateAreaWithRestaurants = CandidateArea & {
  restaurants: Omit<RankedRestaurant, "matchScore" | "rankingScore">[];
};

type DietaryNote = {
  memberName: string;
  labels: string[];
};

function collectSurveySuggestions(
  surveysWithMeta: {
    survey: ReturnType<typeof mapSurveyResponseRow>;
  }[]
): SurveySuggestionInput[] {
  const suggestions = new Map<string, SurveySuggestionInput>();

  for (const { survey } of surveysWithMeta) {
    for (const suggestion of survey.suggestedRestaurants ?? []) {
      const label = suggestion.showName
        ? `${survey.memberName}のおすすめ`
        : "メンバーのおすすめ";
      const existing = suggestions.get(suggestion.id);
      if (!existing || existing.label === "メンバーのおすすめ") {
        suggestions.set(suggestion.id, {
          restaurantId: suggestion.id,
          label,
          recommenderName: suggestion.showName ? survey.memberName : null,
          createdAt: survey.submittedAt.toISOString(),
        });
      }
    }
  }

  return [...suggestions.values()];
}

function makeCandidateArea(
  areaName: string,
  areaHint: CandidateArea | undefined,
  restaurants: Omit<RankedRestaurant, "matchScore" | "rankingScore">[]
): CandidateAreaWithRestaurants {
  if (areaHint) {
    return { ...areaHint, restaurants };
  }

  const metadata = findAreaMetadataByName(areaName);
  return {
    areaName,
    stationName: metadata?.stationName ?? `${areaName}駅`,
    metadata: metadata ?? {
      id: areaName,
      displayName: areaName,
      stationName: `${areaName}駅`,
      areaKind: "district",
      prefecture: "Tokyo",
      hubScore: 0.5,
      supplyScore: 0.5,
      nightlifeScore: 0.5,
      discoveryScore: 0.5,
      reliabilityScore: 0.5,
      nearbyHubs: [],
    },
    scores: {
      transferSimplicity: 0.5,
      midpointCloseness: 0.5,
      stationScale: 0.5,
      restaurantSupply: 0.5,
      nightlifeIntensity: 0.5,
      discoveryPotential: 0.5,
      preferredAreaBonus: 0,
      groupSizeAdjustment: 0.5,
      efficiency: 0.5,
      discovery: 0.5,
      combined: 0.5,
    },
    reasons: [],
    tags: [],
    explanation: "このエリアには信頼リング由来の候補があります。",
    restaurants,
  };
}

function groupRankedByArea(
  ranked: RankedRestaurant[],
  areaHints: CandidateArea[]
): CandidateAreaWithRestaurants[] {
  const hintsByArea = new Map(areaHints.map((area) => [area.areaName, area]));
  const byArea = new Map<string, Omit<RankedRestaurant, "matchScore" | "rankingScore">[]>();

  for (const restaurant of ranked) {
    const areaName = restaurant.area || "その他";
    byArea.set(areaName, [
      ...(byArea.get(areaName) ?? []),
      stripInternalScore(restaurant),
    ]);
  }

  return [...byArea.entries()].map(([areaName, restaurants]) =>
    makeCandidateArea(areaName, hintsByArea.get(areaName), restaurants.slice(0, 8))
  );
}

function buildDietaryNotes(params: {
  surveysWithMeta: {
    survey: ReturnType<typeof mapSurveyResponseRow>;
    profileId: string | null;
  }[];
  profiles: UserProfile[];
}) {
  const restrictionLabels = new Map(
    [...ALLERGIES, ...DIETARY_RESTRICTIONS].map((item) => [item.id, item.name])
  );
  const profilesById = new Map(params.profiles.map((profile) => [profile.id, profile]));

  return params.surveysWithMeta
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

      if (labels.length === 0) return null;
      return { memberName: survey.memberName, labels };
    })
    .filter((note): note is DietaryNote => note !== null);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");

  if (!groupId) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const [{ data: group, error: groupError }, { data: surveyRows, error: surveyError }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name, mode, group_size, session_atmosphere, session_focus, scheduled_at")
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

  const rawSurveyRows = (surveyRows ?? []) as unknown as Record<string, unknown>[];
  const surveys = rawSurveyRows.map((row) => mapSurveyResponseRow(row));
  const surveysWithMeta = rawSurveyRows.map((row) => ({
    survey: mapSurveyResponseRow(row),
    profileId: ((row.group_members as { profile_id?: string } | null)?.profile_id) ?? null,
  }));
  const profileIds = rawSurveyRows
    .map((row) => (row.group_members as { profile_id?: string } | null)?.profile_id)
    .filter(Boolean) as string[];

  let profiles: UserProfile[] = [];
  if (profileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);
    profiles = ((profileRows ?? []) as unknown as Record<string, unknown>[]).map((row) =>
      mapProfileRow(row)
    );
  }

  const groupSize = (group.group_size as number | null) ?? (surveyRows?.length || 2);
  const sessionAtmosphere =
    (group.session_atmosphere as SessionAtmosphere | null) ?? null;
  const sessionFocus = (group.session_focus as SessionFocus | null) ?? null;
  const mode = ((group.mode as GroupMode | null) ?? "planned") as GroupMode;
  const groupGenreScores = calculateGroupGenreScores(surveys, profiles);
  const genreRanking = getGenreRanking(groupGenreScores);
  const { genreCodes } = getSearchParams(genreRanking, 3, sessionFocus);
  const budgetSignals = aggregateBudgetSignals(
    surveys.map((survey) => ({
      idealYen: survey.budgetIdealYen ?? null,
      maxYen: survey.budgetMaxYen ?? null,
      priority: survey.budgetPriority ?? null,
    }))
  );
  const areaHints = recommendCandidateAreas({
    groupSize,
    scheduledAt: (group.scheduled_at as string | null) ?? null,
    sessionAtmosphere,
    sessionFocus,
    responses: surveys.map((survey) => ({
      departureArea: survey.departureArea ?? null,
      departureStation: survey.departureStation ?? null,
      preferredAreas: survey.preferredAreas ?? [],
    })),
  });
  const surveySuggestions = collectSurveySuggestions(surveysWithMeta);
  const pool = await fetchCandidatePool({
    genreCodes,
    memberProfileIds: profileIds,
    surveySuggestions,
  });
  const pooled = [...pool.values()].flat();
  const dietaryNotes = buildDietaryNotes({ surveysWithMeta, profiles });

  if (pooled.length === 0) {
    return NextResponse.json({
      groupName: group.name,
      groupMode: mode,
      groupGenreScores,
      genreRanking,
      resolvedAreas: [],
      dietaryNotes,
      candidatePool: EMPTY_CANDIDATE_POOL,
      candidateAreas: [],
      results: [],
      totalRestaurants: 0,
      fewCandidates: true,
    });
  }

  const ranked = rankCandidatePool({
    pooled,
    mode,
    surveys,
    groupGenreScores,
    budgetSignals,
    groupSize,
    sessionAtmosphere,
    sessionFocus,
  });
  const areaGroups = groupRankedByArea(ranked, areaHints);
  const visibleResults = ranked.map((restaurant) => stripInternalScore(restaurant));

  return NextResponse.json({
    groupName: group.name,
    groupMode: mode,
    groupGenreScores,
    genreRanking,
    resolvedAreas: areaGroups.map((area) => area.areaName),
    dietaryNotes,
    candidatePool: { status: "ready", source: "trust_ring" },
    candidateAreas: areaGroups,
    results: visibleResults,
    totalRestaurants: visibleResults.length,
    fewCandidates: visibleResults.length < 5,
  });
}
