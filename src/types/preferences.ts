import type { GenreCode, DietaryRestrictionId, MoodId } from "@/lib/restaurant-taxonomy";

export type GenrePreference = {
  genre_code: GenreCode;
  preference: -1 | 0 | 1; // -1=dislike, 0=neutral, 1=like
};

export type UserPreferences = {
  genres: GenrePreference[];
  dietary_restrictions: DietaryRestrictionId[];
};

export type SearchParams = {
  member_ids: string[];
  mood?: MoodId;
  location_text: string;
  location_code?: string;
  time_slot?: "lunch" | "dinner" | "late_night";
};
