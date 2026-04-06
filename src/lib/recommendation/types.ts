import type {
  PriorityLevel,
  SessionAtmosphere,
  SessionFocus,
} from "@/lib/types";

// --- Place Algorithm v2 ---

export type AreaReasonCode =
  | "easy_access"
  | "strong_restaurant"
  | "good_for_large_group"
  | "great_discovery"
  | "matches_preference";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  passenger_count: number;
  line_ids: string[];
}

export interface Line {
  id: string;
  name: string;
  operator: string;
  type: "JR" | "metro" | "private";
  station_ids: string[];
}

export interface StationEdge {
  station_a: string;
  station_b: string;
  line_id: string;
}

export interface CandidateAreaScores {
  access: number;
  restaurant: number;
  scale: number;
  discovery: number;
  preference: number;
  combined: number;
}

export interface CandidateArea {
  areaName: string;
  stationName: string;
  stationId: string;
  lat: number;
  lng: number;
  scores: CandidateAreaScores;
  reasons: AreaReasonCode[];
  tags: string[];
  explanation: string;
}

export interface PlaceResponseSignal {
  departureStationId?: string | null;
  preferredStationIds?: string[];
  /** @deprecated v1 text-based fields */
  departureArea?: string | null;
  departureStation?: string | null;
  preferredAreas?: string[];
}

export interface PlaceRecommendationInput {
  groupSize?: number | null;
  responses: PlaceResponseSignal[];
}

// --- Restaurant Algorithm ---

export type RestaurantReasonCode =
  | "budget_overlap"
  | "budget_safe"
  | "preferred_genre_match"
  | "drink_focus_fit"
  | "food_focus_fit"
  | "atmosphere_fit"
  | "restriction_friendly"
  | "group_size_fit";

export interface BudgetSignal {
  tier?: number | null;
  /** @deprecated v1 fields kept for backward compat */
  idealYen?: number | null;
  maxYen?: number | null;
  priority?: PriorityLevel | null;
}

export interface AggregatedBudgetPreference {
  respondentCount: number;
  medianTier: number | null;
  toleranceLower: number | null;
  toleranceUpper: number | null;
}

export interface RestaurantBudgetRange {
  minYen: number | null;
  maxYen: number | null;
}
