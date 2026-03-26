export interface Genre {
  id: string;
  name: string;
  emoji: string;
}

export interface Allergy {
  id: string;
  name: string;
  emoji: string;
}

export interface DietaryRestriction {
  id: string;
  name: string;
  emoji: string;
}

export interface GroupMember {
  id: string;
  displayName: string;
  role: "owner" | "member";
  hasSurvey: boolean;
}

export interface SurveyResponse {
  id: string;
  memberName: string;
  tierS: string[];
  tierA: string[];
  tierB: string[];
  departureStation: string;
  preferredArea: string | null;
  submittedAt: Date;
}

export interface MeshiGroup {
  id: string;
  name: string;
  inviteCode: string;
  status: "active" | "archived";
  members: GroupMember[];
  surveyResponses: SurveyResponse[];
  resolvedAreas: string[];
  decidedRestaurant?: string;
}

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
  hotpepperUrl: string;
  partyCapacity?: number;
  hasPrivateRoom: boolean;
  address?: string;
  openHours?: string;
  phoneNumber?: string;
  area: string;
}

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterName: string;
  areaNames: string[];
  memberCount: number;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  displayName: string;
  dislikedGenres: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  spiceTolerance: number;
  flavorIntensity: number;
}

export type TierKey = "S" | "A" | "B";

export interface TierData {
  S: string[];
  A: string[];
  B: string[];
}
