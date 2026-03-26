"use server";

import { searchRestaurants } from "@/lib/hotpepper/client";
import {
  computeSearchParams,
  scoreRestaurants,
} from "@/lib/matching/engine";
import { MOCK_USER } from "@/lib/mock-user";
import type { MoodId } from "@/lib/hotpepper/constants";
import type { ScoredRestaurant } from "@/types/search";

export async function executeGroupSearch(params: {
  member_ids: string[];
  mood?: MoodId;
  location_code: string;
  location_text: string;
  time_slot?: "lunch" | "dinner" | "late_night";
}): Promise<{ data?: ScoredRestaurant[]; error?: string }> {
  const user = MOCK_USER;
  const allMemberIds = [...new Set([user.id, ...params.member_ids])];

  // No DB preferences in demo mode — use empty arrays
  const members = allMemberIds.map((id) => ({
    user_id: id,
    genres: [],
    dietary_restrictions: [],
  }));

  const { searchParams, excludedGenres, boostedGenres } = computeSearchParams({
    members,
    mood: params.mood,
    locationCode: params.location_code,
    timeSlot: params.time_slot,
  });

  try {
    const { shops } = await searchRestaurants(searchParams);
    const scored = scoreRestaurants(
      shops,
      excludedGenres,
      boostedGenres,
      allMemberIds.length
    );
    return { data: scored };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "検索中にエラーが発生しました";
    return { error: message };
  }
}
