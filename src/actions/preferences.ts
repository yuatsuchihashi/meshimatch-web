"use server";

// Demo mode: preferences are not persisted
export async function upsertGenrePreferences(_preferences: unknown[]) {
  void _preferences;
  return { success: true };
}

export async function addDietaryRestriction(_restrictionType: string) {
  void _restrictionType;
  return { success: true };
}

export async function removeDietaryRestriction(_restrictionType: string) {
  void _restrictionType;
  return { success: true };
}

export async function updateDisplayName(_displayName: string) {
  void _displayName;
  return { success: true };
}
