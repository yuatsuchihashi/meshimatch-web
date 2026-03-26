"use server";

import type { GenreCode, DietaryRestrictionId } from "@/lib/hotpepper/constants";

// Demo mode: preferences are not persisted
export async function upsertGenrePreferences(
  _preferences: { genre_code: GenreCode; preference: -1 | 0 | 1 }[]
) {
  return { success: true };
}

export async function addDietaryRestriction(_restrictionType: DietaryRestrictionId) {
  return { success: true };
}

export async function removeDietaryRestriction(_restrictionType: DietaryRestrictionId) {
  return { success: true };
}

export async function updateDisplayName(_displayName: string) {
  return { success: true };
}
