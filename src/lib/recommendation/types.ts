import type {
  PriorityLevel,
  SessionAtmosphere,
  SessionFocus,
} from "@/lib/types";

export type AreaReasonCode =
  | "easy_gather"
  | "practical_midpoint"
  | "strong_supply"
  | "large_group_safe"
  | "preferred_area_bonus"
  | "discovery_pick";

export type RestaurantReasonCode =
  | "budget_overlap"
  | "budget_safe"
  | "preferred_genre_match"
  | "drink_focus_fit"
  | "food_focus_fit"
  | "atmosphere_fit"
  | "restriction_friendly"
  | "group_size_fit";

export interface AreaMetadata {
  id: string;
  displayName: string;
  stationName: string;
  areaKind: "district" | "hub" | "discovery";
  prefecture: string;
  hubScore: number;
  supplyScore: number;
  nightlifeScore: number;
  discoveryScore: number;
  reliabilityScore: number;
  nearbyHubs: string[];
}

export interface PlaceResponseSignal {
  departureArea?: string | null;
  departureStation?: string | null;
  preferredAreas?: string[];
}

export interface CandidateAreaScores {
  transferSimplicity: number;
  midpointCloseness: number;
  stationScale: number;
  restaurantSupply: number;
  nightlifeIntensity: number;
  discoveryPotential: number;
  preferredAreaBonus: number;
  groupSizeAdjustment: number;
  efficiency: number;
  discovery: number;
  combined: number;
}

export interface CandidateArea {
  areaName: string;
  stationName: string;
  metadata: AreaMetadata;
  scores: CandidateAreaScores;
  reasons: AreaReasonCode[];
  tags: string[];
  explanation: string;
}

export interface PlaceRecommendationInput {
  groupSize?: number | null;
  scheduledAt?: Date | string | null;
  sessionAtmosphere?: SessionAtmosphere | null;
  sessionFocus?: SessionFocus | null;
  responses: PlaceResponseSignal[];
}

export interface BudgetSignal {
  idealYen?: number | null;
  maxYen?: number | null;
  priority?: PriorityLevel | null;
}

export interface AggregatedBudgetPreference {
  respondentCount: number;
  idealLowerYen: number | null;
  idealUpperYen: number | null;
  maxAcceptableYen: number | null;
  strongestPriority: PriorityLevel | null;
}

export interface RestaurantBudgetRange {
  minYen: number | null;
  maxYen: number | null;
}
