// ============================================================
// MeshiMatch – 候補絞り込み (shortlist) API
// ============================================================
// POST /api/groups/shortlist – 幹事が○にした候補をグループに保存
//   保存と同時に幹事の yes 票も記録する (幹事の○=1票として集計に乗る)
// GET  /api/groups/shortlist?group_id=xxx – 現在の shortlist を取得
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export interface ShortlistItem {
  id: string;
  name: string;
  genreId: string;
  area: string;
  budget: string;
  address: string;
  url?: string | null;
  photoUrl?: string | null;
  reasonTags?: string[];
  isMemberFavorite?: boolean;
  endorsementLabel?: string | null;
  publicFavoriteCount?: number;
  officialRecommendedByNames?: string[];
  pr?: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  if (!groupId) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("groups")
    .select("shortlist")
    .eq("id", groupId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({
    shortlist: (data as { shortlist?: ShortlistItem[] | null })?.shortlist ?? null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { groupId, memberId, items } = body as {
    groupId?: string;
    memberId?: string;
    items?: ShortlistItem[];
  };

  if (!groupId || !memberId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "groupId, memberId, items are required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // 幹事チェック
  const { data: membership } = await supabase
    .from("group_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("group_id", groupId)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json(
      { error: "候補の絞り込みは幹事のみできます" },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from("groups")
    .update({ shortlist: items })
    .eq("id", groupId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 幹事の○を票として記録 (絞り込みに残した=幹事のyes)
  for (const item of items) {
    await supabase.from("restaurant_votes").upsert(
      {
        group_id: groupId,
        member_id: memberId,
        restaurant_id: item.id,
        restaurant_name: item.name,
        genre_id: item.genreId,
        vote: "yes",
      },
      { onConflict: "group_id,member_id,restaurant_id" }
    );
  }

  return NextResponse.json({ ok: true, count: items.length }, { status: 201 });
}
