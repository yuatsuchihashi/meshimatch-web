"use server";

// Demo mode: favorites are not persisted
export async function saveFavoriteRestaurant(_restaurant: unknown) {
  return { success: true };
}

export async function removeFavoriteRestaurant(_hotpepperId: string) {
  return { success: true };
}
