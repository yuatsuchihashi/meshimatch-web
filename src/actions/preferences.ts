"use server";

// Demo mode: preferences are not persisted
export async function upsertGenrePreferences(_preferences: unknown[]) {
  return { success: true };
}

export async function addDietaryRestriction(_restrictionType: string) {
  return { success: true };
}

export async function removeDietaryRestriction(_restrictionType: string) {
  return { success: true };
}

export async function updateDisplayName(_displayName: string) {
  return { success: true };
}
