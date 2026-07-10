import { buildGenrePreferencesFromMoods } from "@/lib/moods";
import type { GenrePreferenceInput, PriorityLevel, UserProfile } from "@/lib/types";

export interface PlannedSurveyProfileDefaults {
  departureStation: string | null;
  allergyNote: string | null;
  dietaryNote: string | null;
  budgetMaxYen: number | null;
  budgetPriority: PriorityLevel | null;
  genrePreferences: GenrePreferenceInput[];
  dietaryRestrictions: UserProfile["dietaryRestrictions"];
}

export interface PlannedSurveyPayloadInput {
  profileDefaults?: PlannedSurveyProfileDefaults | null;
  departureStation?: string | null;
  budgetMaxYen?: number | null;
  preferenceMoods?: {
    prefer: string[];
    avoid: string[];
    changed: boolean;
  };
  preferMoods: string[];
  avoidMoods: string[];
  preferredAreas?: string[];
  allergyNote?: string | null;
  dietaryNote?: string | null;
  dietaryRestrictions?: UserProfile["dietaryRestrictions"];
}

export function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPlannedSurveyProfileDefaults(
  profile: UserProfile | null | undefined
): PlannedSurveyProfileDefaults {
  return {
    departureStation: normalizeOptionalText(profile?.usualDepartureStation),
    allergyNote: normalizeOptionalText(profile?.allergyNote),
    dietaryNote: normalizeOptionalText(profile?.dietaryNote),
    budgetMaxYen: profile?.usualBudgetMaxYen ?? null,
    budgetPriority: profile?.usualBudgetPriority ?? null,
    genrePreferences: profile?.favoriteGenres ?? [],
    dietaryRestrictions: profile?.dietaryRestrictions ?? [],
  };
}

export function buildPlannedSurveyPayload(input: PlannedSurveyPayloadInput) {
  const profileDefaults = input.profileDefaults ?? null;
  const preferenceMoods = input.preferenceMoods;
  const genrePreferences =
    preferenceMoods?.changed === true
      ? buildGenrePreferencesFromMoods(preferenceMoods.prefer, preferenceMoods.avoid)
      : profileDefaults?.genrePreferences ?? [];
  const budgetMaxYen =
    input.budgetMaxYen !== undefined
      ? input.budgetMaxYen
      : profileDefaults?.budgetMaxYen ?? null;

  return {
    departureArea: null,
    departureStation: normalizeOptionalText(
      input.departureStation ?? profileDefaults?.departureStation ?? null
    ),
    preferredAreas: input.preferredAreas ?? [],
    budgetIdealYen: null,
    budgetMaxYen,
    budgetPriority: budgetMaxYen ? "prefer" : null,
    preferMoods: input.preferMoods,
    avoidMoods: input.avoidMoods,
    genrePreferences,
    dietaryRestrictions:
      input.dietaryRestrictions ?? profileDefaults?.dietaryRestrictions ?? [],
    allergyNote: normalizeOptionalText(input.allergyNote ?? profileDefaults?.allergyNote),
    dietaryNote: normalizeOptionalText(input.dietaryNote ?? profileDefaults?.dietaryNote),
  };
}
