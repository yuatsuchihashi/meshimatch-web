import type { DietaryRestrictionInput, GenrePreferenceInput } from "@/lib/types";
import type { InstantConsensusAnswer } from "./consensus";

export type InstantLocationSource = "gps" | "manual";
export type InstantParticipantSource = "manual" | "profile" | "auto";

export interface InstantZoneSelection {
  zoneId: string;
  name: string;
  station: string;
  source: InstantLocationSource;
}

export interface InstantStartState {
  zone: InstantZoneSelection | null;
  partySize: number;
  createdAt: string;
}

export interface InstantParticipantInput {
  id: string;
  nickname: string;
  profileId?: string | null;
  source: InstantParticipantSource;
  consensusAnswer?: InstantConsensusAnswer;
  ngLabels: string[];
  allergyNote?: string | null;
  dietaryNote?: string | null;
  genrePreferences: GenrePreferenceInput[];
  dietaryRestrictions: DietaryRestrictionInput[];
}

export interface InstantAggregateItem {
  label: string;
  count: number;
}

export interface InstantAggregate {
  ng: InstantAggregateItem[];
  genres: InstantAggregateItem[];
}

export interface InstantGroupCreationInput {
  zone: InstantZoneSelection | null;
  partySize: number;
  participants: InstantParticipantInput[];
  createdBy?: string | null;
  nowIso?: string;
}
