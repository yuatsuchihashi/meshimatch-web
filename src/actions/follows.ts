"use server";

// Demo mode: follows are not persisted
export async function followUser(_targetUserId: string) {
  return { success: true };
}

export async function unfollowUser(_targetUserId: string) {
  return { success: true };
}

export async function searchUsers(
  _query: string
): Promise<{ data: { id: string; display_name: string; avatar_url: string | null }[] }> {
  return { data: [] };
}
