"use server";

// Demo mode: favorites are not persisted
export async function saveFavoriteRestaurant(_restaurant: unknown) {
  void _restaurant;
  return { success: true };
}

export async function removeFavoriteRestaurant(_restaurantId: string) {
  void _restaurantId;
  return { success: true };
}
