import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { searchRestaurants } from "@/lib/hotpepper/client";
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

const AREA_TO_MIDDLE_CODE: Record<string, string> = {
  "渋谷": "Y055",
  "新宿": "Y050",
  "池袋": "Y045",
  "東京": "Y035",
  "品川": "Y060",
  "上野": "Y030",
  "銀座": "Y040",
  "六本木": "Y065",
  "恵比寿": "Y056",
  "目黒": "Y061",
  "秋葉原": "Y033",
  "浅草": "Y025",
  "横浜": "Y200",
  "吉祥寺": "Y070",
  "立川": "Y080",
  "町田": "Y090",
};

const ATMOSPHERE_KEYWORDS: Partial<Record<SessionAtmosphere, string>> = {
  casual: "カジュアル",
  polished: "おしゃれ",
  lively: "宴会",
  calm: "落ち着いた",
};

type SortMode = "match" | "rating";

type CandidateAreaWithRestaurants = CandidateArea & {
  restaurants: Restaurant[];
};

type DietaryNote = {
  memberName: string;
  labels: string[];
};

function makeRestaurant(shop: Record<string, unknown>, areaName: string): Restaurant {
  const genre = (shop.genre as { name?: string; code?: string } | undefined) ?? {};
  const budget = (shop.budget as { average?: string } | undefined) ?? {};
  const photo = (shop.photo as { pc?: { l?: string }; mobile?: { l?: string } } | undefined) ?? {};
  const urls = (shop.urls as { pc?: string } | undefined) ?? {};

  return {
    id: shop.id as string,
    name: (shop.name as string) ?? "",
    genre: genre.name ?? "",
    genreId: genre.code ?? "",
    budget: budget.average ?? "",
    photoUrl: photo.pc?.l ?? photo.mobile?.l,
    matchScore: 0,
    rating: 0,
    access: (shop.access as string) ?? "",
    hotpepperUrl: urls.pc,
    hasPrivateRoom: shop.private_room === "あり",
    address: (shop.address as string) ?? "",
    area: areaName,
  };
}

async function fetchAreaRestaurants(params: {
  area: CandidateArea;
  genreCodes: string[];
  keywords: string[];
  sortBy: SortMode;
  groupGenreScores: ReturnType<typeof calculateGroupGenreScores>;
  budgetSignals: ReturnType<typeof aggregateBudgetSignals>;
  sessionAtmosphere: SessionAtmosphere | null;
  sessionFocus: SessionFocus | null;
  groupSize: number;
}) {
  const {
    area,
    genreCodes,
    keywords,
    sortBy,
    groupGenreScores,
    budgetSignals,
    sessionAtmosphere,
    sessionFocus,
    groupSize,
  } = params;
  const middleAreaCode = AREA_TO_MIDDLE_CODE[area.areaName];
  const atmosphereKeyword = sessionAtmosphere ? ATMOSPHERE_KEYWORDS[sessionAtmosphere] : undefined;
  const restaurants = new Map<string, Restaurant>();

  const searchTasks = [
    ...genreCodes.map((genreCode) =>
      searchRestaurants({
        genre: genreCode,
        middle_area: middleAreaCode,
        keyword: atmosphereKeyword,
        count: 8,
        free_drink: sessionFocus === "drink_centered" ? 1 : undefined,
      })
    ),
    ...keywords.slice(0, 2).map((keyword) =>
      searchRestaurants({
        keyword: [keyword, atmosphereKeyword].filter(Boolean).join(" "),
        middle_area: middleAreaCode,
        count: 5,
      })
    ),
  ];

  for (const task of searchTasks) {
    try {
      const result = await task;
      for (const shop of result.shops) {
        const restaurant = makeRestaurant(shop as Record<string, unknown>, area.areaName);
        if (!restaurants.has(restaurant.id)) {
          restaurants.set(restaurant.id, restaurant);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch restaurants for ${area.areaName}:`, error);
    }
  }

  const ranked = scoreAndRankRestaurants(
    Array.from(restaurants.values()),
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

    return {
      ...result.restaurant,
      matchScore: sessionScore.matchScore,
      rating: sessionScore.rating,
      reasonTags: sessionScore.reasonTags,
      reasonExplanation: sessionScore.reasonExplanation,
      genreScore: result.genreScore,
    };
  });

  return ranked.sort((a, b) =>
    sortBy === "rating" ? b.rating - a.rating : b.matchScore - a.matchScore
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  const sortBy = (searchParams.get("sort") as SortMode) ?? "match";

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

  if (!surveyRows || surveyRows.length === 0) {
    return NextResponse.json(
      { error: "まだアンケートが提出されていません" },
      { status: 400 }
    );
  }

  const surveys = (surveyRows as unknown as Record<string, unknown>[]).map((row) =>
    mapSurveyResponseRow(row)
  );
  const surveyRowsWithMeta = (surveyRows as unknown as Record<string, unknown>[]).map((row) => ({
    survey: mapSurveyResponseRow(row),
    profileId: ((row.group_members as { profile_id?: string } | null)?.profile_id) ?? null,
  }));
  const profileIds = surveyRows
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
  const { genreCodes, keywords } = getSearchParams(
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
    groupSize: (group.group_size as number | null) ?? surveyRows.length,
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
              groupSize: (group.group_size as number | null) ?? surveyRows.length,
              sessionAtmosphere: (group.session_atmosphere as SessionAtmosphere | null) ?? null,
              sessionFocus: (group.session_focus as SessionFocus | null) ?? null,
              scheduledAt: (group.scheduled_at as string | null) ?? null,
              responses: [{ preferredAreas: [areaName] }],
            }, 1)[0]
          )
          .filter(Boolean);

  const areaGroups: CandidateAreaWithRestaurants[] = await Promise.all(
    fallbackAreas.map(async (area) => {
      const restaurants = await fetchAreaRestaurants({
        area,
        genreCodes,
        keywords,
        sortBy,
        groupGenreScores,
        budgetSignals,
        sessionAtmosphere: (group.session_atmosphere as SessionAtmosphere | null) ?? null,
        sessionFocus: (group.session_focus as SessionFocus | null) ?? null,
        groupSize: (group.group_size as number | null) ?? surveyRows.length,
      });

      return {
        ...area,
        restaurants: restaurants.slice(0, 8),
      };
    })
  );

  const flatResults = areaGroups.flatMap((area) => area.restaurants);
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
      const labels = [...new Set(restrictionIds)]
        .map((restrictionId) => restrictionLabels.get(restrictionId) ?? restrictionId)
        .filter(Boolean);

      if (labels.length === 0) {
        return null;
      }

      return {
        memberName: survey.memberName,
        labels,
      };
    })
    .filter((note): note is DietaryNote => note !== null);

  return NextResponse.json({
    groupName: group.name,
    groupGenreScores,
    genreRanking,
    resolvedAreas: areaGroups.map((area) => area.areaName),
    dietaryNotes,
    candidateAreas: areaGroups,
    results: flatResults,
    totalRestaurants: flatResults.length,
  });
}
