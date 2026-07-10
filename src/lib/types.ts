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

export type PriorityLevel = "must" | "prefer" | "optional" | "avoid";

export type SessionAtmosphere = "casual" | "polished" | "lively" | "calm";

export type SessionFocus = "drink_centered" | "food_centered" | "balanced";

export type GroupMode = "instant" | "planned";

export type RestaurantMetadataSource =
  | "member_input"
  | "official_input"
  | "gmaps_import";

export interface GenrePreferenceInput {
  genreId: string;
  priority: PriorityLevel;
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
  profileId?: string | null;
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
  departureStation?: string | null;
  preferredArea: string | null;
  budgetIdealYen?: number | null;
  budgetMaxYen?: number | null;
  budgetPriority?: PriorityLevel | null;
  genrePreferences?: GenrePreferenceInput[];
  dietaryRestrictions?: DietaryRestrictionInput[];
  allergyNote?: string | null;
  dietaryNote?: string | null;
  preferMoods?: string[];
  avoidMoods?: string[];
  suggestedRestaurants?: { id: string; name: string; showName: boolean }[];
  submittedAt: Date;
}

export interface MeshiGroup {
  id: string;
  name: string;
  inviteCode: string;
  mode?: GroupMode;
  scheduledAt?: Date | null;
  groupSize?: number | null;
  sessionAtmosphere?: SessionAtmosphere | null;
  sessionFocus?: SessionFocus | null;
  status: "active" | "archived" | "decided" | "all_responded" | "completed";
  members: GroupMember[];
  surveyResponses: SurveyResponse[];
  resolvedAreas: string[];
  decidedRestaurant?: string;
  decidedRestaurantId?: string | null;
  decidedAt?: Date | null;
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
  lat?: number;
  lng?: number;
  placeId?: string | null;
  googleRating?: number | null;
  openingHours?: Record<string, unknown> | null;
  openingHoursSource?: RestaurantMetadataSource | null;
  openingHoursUpdatedAt?: string | null;
  pr?: boolean;
  reasonTags?: string[];
  reasonExplanation?: string;
  genreScore?: number;
  recommendedByNames?: string[];
  recommendationLabel?: string | null;
  recommendedAt?: string | null;
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
  bio?: string | null;              // 一言プロフィール (旧「MeshiMatchユーザー」枠)
  avatarUrl?: string | null;
  allergyNote?: string | null;      // アレルギー自由記入 (50字)
  dietaryNote?: string | null;      // 食事制限自由記入 (50字)
  usualPreferMoods?: string[];      // 普段の気分 (moods.ts の id)
  usualAvoidMoods?: string[];
  allergies: string[];             // アレルギー → 注意喚起のみ（スコアリング不使用）
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

export interface OfficialVerificationGrant {
  id: string;
  profileId: string;
  grantedAt: string;
  grantedBy?: string | null;
  note?: string | null;
}

export interface Zone {
  id: string;
  name: string;
  generation: number;
}

export interface StationZoneMap {
  station: string;
  zoneId: string;
  generation: number;
}

// --- Survey / Genre Preference Buckets ---
export type GenrePreferenceBucketKey = "prioritize" | "nice_to_have" | "open_to_it";

export interface GenrePreferenceBucketData {
  prioritize: string[];
  nice_to_have: string[];
  open_to_it: string[];
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
