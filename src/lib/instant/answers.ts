import type {
  InstantConsensusAnswer,
  InstantConsensusNg,
} from "./consensus";
import type {
  InstantConsensusMood,
  InstantConsensusStyle,
} from "./consensus-config";
import type { InstantParticipantInput } from "./types";
import type { DietaryRestrictionInput } from "@/lib/types";

export interface InstantConsensusAnswerDraft {
  ng: InstantConsensusNg | null;
  dietaryRestrictions: DietaryRestrictionInput[];
  mood: InstantConsensusMood | null;
  style: InstantConsensusStyle | null;
}

export function emptyInstantConsensusAnswerDraft(): InstantConsensusAnswerDraft {
  return {
    ng: null,
    dietaryRestrictions: [],
    mood: null,
    style: null,
  };
}

export function toggleInstantDietaryRestriction(
  draft: InstantConsensusAnswerDraft,
  restrictionId: string
): InstantConsensusAnswerDraft {
  const selected = draft.dietaryRestrictions.some(
    (item) => item.restrictionId === restrictionId
  );
  const dietaryRestrictions = selected
    ? draft.dietaryRestrictions.filter((item) => item.restrictionId !== restrictionId)
    : [...draft.dietaryRestrictions, { restrictionId, priority: "must" as const }];

  return { ...draft, dietaryRestrictions };
}

export function buildInstantConsensusAnswer(
  draft: InstantConsensusAnswerDraft
): InstantConsensusAnswer {
  return {
    ng: draft.ng ?? "none",
    dietaryRestrictions: draft.dietaryRestrictions,
    mood: draft.mood,
    style: draft.style,
  };
}

export function buildInstantParticipantFromConsensus(params: {
  id: string;
  label: string;
  draft: InstantConsensusAnswerDraft;
  source?: InstantParticipantInput["source"];
  ngLabel?: string | null;
}): InstantParticipantInput {
  return {
    id: params.id,
    nickname: params.label,
    source: params.source ?? "manual",
    consensusAnswer: buildInstantConsensusAnswer(params.draft),
    ngLabels: params.ngLabel ? [params.ngLabel] : [],
    allergyNote: null,
    dietaryNote: null,
    genrePreferences: [],
    dietaryRestrictions: params.draft.dietaryRestrictions,
  };
}

export function buildInstantParticipantFromWishAvoid(params: {
  id: string;
  label: string;
  wishGenreIds: readonly string[];
  avoidLabels: readonly string[];
  avoidGenreIds?: readonly string[];
  avoidRestrictionIds?: readonly string[];
  dietaryRestrictions: DietaryRestrictionInput[];
}): InstantParticipantInput {
  const restrictions = [...params.dietaryRestrictions];
  for (const restrictionId of params.avoidRestrictionIds ?? []) {
    if (!restrictions.some((item) => item.restrictionId === restrictionId)) {
      restrictions.push({ restrictionId, priority: "must" });
    }
  }

  return {
    id: params.id,
    nickname: params.label,
    source: "manual",
    ngLabels: [...new Set(params.avoidLabels)],
    allergyNote: null,
    dietaryNote: null,
    genrePreferences: [
      ...params.wishGenreIds.map((genreId) => ({
        genreId,
        priority: "prefer" as const,
      })),
      ...(params.avoidGenreIds ?? []).map((genreId) => ({
        genreId,
        priority: "avoid" as const,
      })),
    ],
    dietaryRestrictions: restrictions,
  };
}
