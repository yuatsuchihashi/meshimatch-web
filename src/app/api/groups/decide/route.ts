// ============================================================
// MeshiMatch – Restaurant Decision API
// ============================================================
// POST /api/groups/decide – レストラン決定を保存
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { groupId, restaurantName, restaurantId, genreId, decidedBy } = body;

  if (!groupId || !restaurantName) {
    return NextResponse.json(
      { error: "groupId and restaurantName are required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // upsert: 1グループ1決定 (group_id はUNIQUE)
  const { data, error } = await supabase
    .from("decisions")
    .upsert(
      {
        group_id: groupId,
        restaurant_name: restaurantName,
        restaurant_id: restaurantId ?? null,
        genre_id: genreId ?? null,
        decided_by: decidedBy ?? null,
      },
      { onConflict: "group_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // グループのステータスを archived に更新
  await supabase
    .from("groups")
    .update({ status: "archived" })
    .eq("id", groupId);

  return NextResponse.json({ decision: data }, { status: 201 });
}
