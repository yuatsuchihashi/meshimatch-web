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
  tierS: string[];
  tierA: string[];
  tierB: string[];
  disliked?: string[];
  preferredAreas?: string[];
  departureStation: string;
  preferredArea: string | null;
  submittedAt: Date;
}

export interface MeshiGroup {
  id: string;
  name: string;
  inviteCode: string;
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
  dislikedGenres: string[];        // 苦手ジャンル → スコアに -0.8
  allergies: string[];             // アレルギー → 注意喚起のみ（スコアリング不使用）
  // --- v2で追加予定 ---
  dietaryPresets?: string[];
  dietaryStrictness?: DietaryStrictness;
}

// --- Survey / Tier ---
export type TierKey = "S" | "A" | "B";

export interface TierData {
  S: string[];
  A: string[];
  B: string[];
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
