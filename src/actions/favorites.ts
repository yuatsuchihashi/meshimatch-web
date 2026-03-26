"use server";

import type { ScoredRestaurant } from "@/types/search";

// Demo mode: favorites are not persisted
export async function saveFavoriteRestaurant(_restaurant: ScoredRestaurant) {
  return { success: true };
}

export async function removeFavoriteRestaurant(_hotpepperId: string) {
  return { success: true };
}
