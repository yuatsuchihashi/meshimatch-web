"use server";

// Demo mode: uses mock data
export async function executeGroupSearch(_params: {
  member_ids: string[];
  mood?: string;
  location_code: string;
  location_text: string;
  time_slot?: "lunch" | "dinner" | "late_night";
}) {
  return { data: [], error: null };
}
