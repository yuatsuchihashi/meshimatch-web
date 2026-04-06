// ============================================================
// MeshiMatch – Core Type Definitions
// ============================================================

// --- Genre ---
export interface Genre {
  id: string;
  name: string;
  emoji: string;
}

// --- Allergy (注意喚起のみ、スコアリングには使わない) ---
export interface Allergy {
  id: string;
  name: string;
  emoji: string;
}

// --- v2用: Dietary Preset (食事制限プリセット) ---
export type DietaryStrictness = "flexible" | "needOptions";

export interface DietaryPreset {
  id: string;
  name: string;
  emoji: string;
  genreScores: Record<string, number>;
}

// --- 旧 DietaryRestriction (後方互換) ---
export interface DietaryRestriction {
  id: string;
  name: string;
  emoji: string;
}

export type PriorityLevel = "must" | "prefer" | "optional";

export type GenrePriorityLevel =
  | "must" | "prefer" | "optional"
  | "rather_not" | "prefer_avoid" | "definitely_avoid";

export type SessionAtmosphere = "casual" | "polished" | "lively" | "calm";

export type SessionFocus = "drink_centered" | "food_centered" | "balanced";

export interface GenrePreferenceInput {
  genreId: string;
  priority: GenrePriorityLevel;
}

export interface DietaryRestrictionInput {
  restrictionId: string;
  priority: PriorityLevel;
}

export interface BudgetPreference {
  idealYen?: number | null;
  maxYen?: number | null;
  priority?: PriorityLevel | null;
}

// --- Group ---
export interface GroupMember {
  id: string;
  displayName: string;
  role: "owner" | "member";
  hasSurvey: boolean;
}

export interface SurveyResponse {
  id: string;
  memberName: string;
  memberId?: string;
  responseVersion?: number;
  preferredAreas?: string[];
  departureArea?: string | null;
  departureStation: string;
  preferredArea: string | null;
  budgetTier?: number | null;
  /** @deprecated v1 fields */
  budgetIdealYen?: number | null;
  budgetMaxYen?: number | null;
  budgetPriority?: PriorityLevel | null;
  genrePreferences?: GenrePreferenceInput[];
  dietaryRestrictions?: DietaryRestrictionInput[];
  submittedAt: Date;
}

export interface MeshiGroup {
  id: string;
  name: string;
  inviteCode: string;
  scheduledAt?: Date | null;
  groupSize?: number | null;
  sessionAtmosphere?: SessionAtmosphere | null;
  sessionFocus?: SessionFocus | null;
  status: "active" | "archived" | "decided" | "all_responded" | "completed";
  members: GroupMember[];
  surveyResponses: SurveyResponse[];
  resolvedAreas: string[];
  decidedRestaurant?: string;
}

// --- Restaurant ---
export interface Restaurant {
  id: string;
  name: string;
  genre: string;
  genreId: string;
  budget: string;
  photoUrl?: string;
  matchScore: number;
  rating: number;
  access: string;
  hotpepperUrl?: string;
  partyCapacity?: number;
  hasPrivateRoom: boolean;
  address?: string;
  openHours?: string;
  phoneNumber?: string;
  area: string;
  reasonTags?: string[];
  reasonExplanation?: string;
  genreScore?: number;
}

// --- Invitation ---
export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterName: string;
  areaNames: string[];
  memberCount: number;
  createdAt: Date;
}

// --- User Profile ---
export interface UserProfile {
  id: string;
  displayName: string;
  allergies: string[];             // アレルギー → 注意喚起のみ（スコアリング不使用）
  usualBudgetTier?: number | null;
  /** @deprecated v1 fields */
  usualBudgetIdealYen?: number | null;
  usualBudgetMaxYen?: number | null;
  usualBudgetPriority?: PriorityLevel | null;
  usualAreas?: string[];
  favoriteGenres?: GenrePreferenceInput[];
  dislikedItems?: string[];
  dietaryPresets?: string[];
  dietaryStrictness?: DietaryStrictness;
  dietaryRestrictions?: DietaryRestrictionInput[];
}

// --- Survey / Genre Preference Buckets ---
export type GenrePreferenceBucketKey =
  | "prioritize"
  | "nice_to_have"
  | "open_to_it"
  | "rather_not"
  | "prefer_avoid"
  | "definitely_avoid";

export interface GenrePreferenceBucketData {
  prioritize: string[];
  nice_to_have: string[];
  open_to_it: string[];
  rather_not: string[];
  prefer_avoid: string[];
  definitely_avoid: string[];
}

// --- Matching Engine 出力 ---
export interface GenreScore {
  genreId: string;
  genreName: string;
  score: number;           // -1.0 ~ +1.0
  normalizedScore: number; // 0.0 ~ 1.0
}

export interface MatchResult {
  restaurant: Restaurant;
  matchScore: number;      // 0.0 ~ 1.0
  genreScore: number;      // -1.0 ~ +1.0 (raw)
}
