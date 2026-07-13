import { GENRES } from "@/lib/restaurant-taxonomy";
import type {
  DietaryRestrictionInput,
  GenrePreferenceInput,
  PriorityLevel,
  UserProfile,
} from "@/lib/types";
import type {
  InstantAggregate,
  InstantParticipantInput,
  InstantParticipantSource,
} from "./types";

export interface InstantRoundDraft {
  ngLabels: string[];
  genrePreferences: GenrePreferenceInput[];
  dietaryRestrictions: DietaryRestrictionInput[];
}

function increment(map: Map<string, number>, label: string) {
  const normalized = label.trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toItems(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
}

export function aggregateInstantParticipants(
  participants: InstantParticipantInput[]
): InstantAggregate {
  const ngCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const genreNames = new Map<string, string>(
    GENRES.map((genre) => [genre.code, genre.name])
  );

  for (const participant of participants) {
    for (const label of participant.ngLabels) increment(ngCounts, label);
    if (participant.allergyNote) increment(ngCounts, participant.allergyNote);
    if (participant.dietaryNote) increment(ngCounts, participant.dietaryNote);
    for (const restriction of participant.dietaryRestrictions) {
      increment(ngCounts, restriction.restrictionId);
    }
    for (const preference of participant.genrePreferences) {
      increment(genreCounts, genreNames.get(preference.genreId) ?? preference.genreId);
    }
  }

  return {
    ng: toItems(ngCounts),
    genres: toItems(genreCounts),
  };
}

export function timedOutDraftToParticipant(params: {
  draft: InstantRoundDraft;
  index: number;
  id: string;
}): InstantParticipantInput {
  return {
    id: params.id,
    nickname: `${params.index + 1}人目`,
    source: "auto",
    ngLabels: params.draft.ngLabels,
    allergyNote: null,
    dietaryNote: null,
    genrePreferences: params.draft.genrePreferences,
    dietaryRestrictions: params.draft.dietaryRestrictions,
  };
}

function priority(value: PriorityLevel | null | undefined): PriorityLevel {
  return value ?? "prefer";
}

export function profileToInstantParticipant(
  profile: UserProfile,
  id: string,
  source: InstantParticipantSource = "profile"
): InstantParticipantInput {
  return {
    id,
    nickname: profile.displayName,
    profileId: profile.id,
    source,
    ngLabels: [...(profile.allergies ?? []), ...(profile.dislikedItems ?? [])],
    allergyNote: profile.allergyNote ?? null,
    dietaryNote: profile.dietaryNote ?? null,
    genrePreferences: (profile.favoriteGenres ?? []).map((genre) => ({
      genreId: genre.genreId,
      priority: priority(genre.priority),
    })),
    dietaryRestrictions: (profile.dietaryRestrictions ?? []).map((restriction) => ({
      restrictionId: restriction.restrictionId,
      priority: priority(restriction.priority),
    })),
  };
}
