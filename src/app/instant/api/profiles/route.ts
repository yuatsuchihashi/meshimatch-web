import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { mapProfileRow } from "@/lib/session-data";

export async function GET() {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      display_name,
      bio,
      avatar_url,
      allergy_note,
      dietary_note,
      usual_departure_station,
      usual_prefer_moods,
      usual_avoid_moods,
      allergies,
      usual_budget_ideal_yen,
      usual_budget_max_yen,
      usual_budget_priority,
      usual_areas,
      favorite_genres,
      disliked_items,
      dietary_restrictions
    `)
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    mapProfileRow(row)
  );

  return NextResponse.json({ profiles });
}
