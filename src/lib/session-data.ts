import type { SurveyResponse, UserProfile } from "@/lib/types";

type RawSurveyRow = Record<string, unknown> & {
  group_members?: { display_name?: string | null; profile_id?: string | null } | null;
};

type RawProfileRow = Record<string, unknown>;

export function normalizePreferredAreas(
  preferredAreas?: string[] | null,
  preferredArea?: string | null
) {
  if ((preferredAreas?.length ?? 0) > 0) {
    return preferredAreas ?? [];
  }

  return preferredArea ? [preferredArea] : [];
}

export function mapSurveyResponseRow(
  row: RawSurveyRow,
  fallbackMemberName?: string
): SurveyResponse {
  const preferredAreas = normalizePreferredAreas(
    (row.preferred_areas as string[]) ?? [],
    (row.preferred_area as string | null) ?? null
  );

  return {
    id: row.id as string,
    memberName:
      fallbackMemberName ??
      ((row.group_members as { display_name?: string | null } | null)?.display_name as string) ??
      "不明",
    memberId: (row.member_id as string) ?? undefined,
    responseVersion: (row.response_version as number) ?? 2,
    preferredAreas,
    departureArea: (row.departure_area as string) ?? null,
    departureStation: (row.departure_station as string) ?? "",
    preferredArea: preferredAreas[0] ?? null,
    budgetCeiling: (row.budget_ceiling as number) ?? null,
    budgetTier: (row.budget_tier as number) ?? null,
    budgetIdealYen: (row.budget_ideal_yen as number) ?? null,
    budgetMaxYen: (row.budget_max_yen as number) ?? null,
    budgetPriority: (row.budget_priority as SurveyResponse["budgetPriority"]) ?? null,
    genrePreferences:
      (row.genre_preferences as SurveyResponse["genrePreferences"]) ?? [],
    dietaryRestrictions:
      (row.dietary_restrictions as SurveyResponse["dietaryRestrictions"]) ?? [],
    submittedAt: new Date(row.submitted_at as string),
  };
}

export function mapProfileRow(row: RawProfileRow): UserProfile {
  return {
    id: row.id as string,
    displayName: (row.display_name as string) ?? "ユーザー",
    allergies: (row.allergies as string[]) ?? [],
    usualBudgetCeiling: (row.usual_budget_ceiling as number) ?? null,
    usualBudgetTier: (row.usual_budget_tier as number) ?? null,
    usualBudgetIdealYen: (row.usual_budget_ideal_yen as number) ?? null,
    usualBudgetMaxYen: (row.usual_budget_max_yen as number) ?? null,
    usualBudgetPriority: (row.usual_budget_priority as UserProfile["usualBudgetPriority"]) ?? null,
    usualAreas: (row.usual_areas as string[]) ?? [],
    favoriteGenres: (row.favorite_genres as UserProfile["favoriteGenres"]) ?? [],
    dislikedItems: (row.disliked_items as string[]) ?? [],
    dietaryRestrictions:
      (row.dietary_restrictions as UserProfile["dietaryRestrictions"]) ?? [],
  };
}
