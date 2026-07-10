// ============================================================
// MeshiMatch – Survey API
// ============================================================
// POST /api/groups/survey – アンケート回答送信
// GET  /api/groups/survey?group_id=xxx – グループのアンケート一覧
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  mapSurveyResponseRow,
  normalizePreferredAreas,
} from "@/lib/session-data";
import { isVerified, type VerificationClient } from "@/lib/verification";

type SuggestedRestaurantInput = {
  id: string;
  name: string;
  showName: boolean;
  pr?: boolean;
};

function sanitizeSuggestedRestaurantsPr(
  suggestedRestaurants: unknown,
  verified: boolean
): SuggestedRestaurantInput[] {
  if (!Array.isArray(suggestedRestaurants)) return [];

  return suggestedRestaurants.map((restaurant) => {
    if (restaurant == null || typeof restaurant !== "object") {
      return restaurant as SuggestedRestaurantInput;
    }
    return {
      ...(restaurant as SuggestedRestaurantInput),
      pr: verified && (restaurant as SuggestedRestaurantInput).pr === true,
    };
  });
}

// ----- GET: グループのアンケート取得 -----
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");

  if (!groupId) {
    return NextResponse.json(
      { error: "group_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("survey_responses")
    .select(`
      *,
      group_members!inner (
        id,
        display_name,
        profile_id
      )
    `)
    .eq("group_id", groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // フロント用に整形
  const surveys = (data ?? []).map((row) => ({
    ...mapSurveyResponseRow(row),
    profileId: row.group_members?.profile_id,
  }));

  return NextResponse.json({ surveys });
}

// ----- POST: アンケート送信 -----
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    groupId,
    memberId,
    preferredAreas,
    preferredArea,
    departureArea,
    departureStation,
    budgetIdealYen,
    budgetMaxYen,
    budgetPriority,
    genrePreferences,
    dietaryRestrictions,
    allergyNote,
    dietaryNote,
    preferMoods,
    avoidMoods,
    suggestedRestaurants,
    responseVersion,
  } = body;

  if (!groupId || !memberId) {
    return NextResponse.json(
      { error: "groupId and memberId are required" },
      { status: 400 }
    );
  }

  const normalizedPreferredAreas = normalizePreferredAreas(
    preferredAreas,
    preferredArea ?? null
  );
  const normalizedGenrePreferences = genrePreferences ?? [];

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const supabase = await createServiceClient();
  const verified = await isVerified(
    supabase as unknown as VerificationClient,
    user?.id ?? null
  );
  const sanitizedSuggestedRestaurants = sanitizeSuggestedRestaurantsPr(
    suggestedRestaurants,
    verified
  );

  // 1. サーベイを upsert (同じメンバーが再回答した場合は上書き)
  const { data, error } = await supabase
    .from("survey_responses")
    .upsert(
      {
        group_id: groupId,
        member_id: memberId,
        departure_area: departureArea ?? null,
        departure_station: departureStation ?? null,
        preferred_areas: normalizedPreferredAreas,
        budget_ideal_yen: budgetIdealYen ?? null,
        budget_max_yen: budgetMaxYen ?? null,
        budget_priority: budgetPriority ?? null,
        genre_preferences: normalizedGenrePreferences,
        dietary_restrictions: dietaryRestrictions ?? [],
        allergy_note: allergyNote ?? null,
        dietary_note: dietaryNote ?? null,
        prefer_moods: preferMoods ?? [],
        avoid_moods: avoidMoods ?? [],
        suggested_restaurants: sanitizedSuggestedRestaurants,
        response_version: responseVersion ?? 2,
      },
      { onConflict: "group_id,member_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. group_members の has_survey を true に
  await supabase
    .from("group_members")
    .update({ has_survey: true })
    .eq("id", memberId);

  return NextResponse.json({ survey: data }, { status: 201 });
}
