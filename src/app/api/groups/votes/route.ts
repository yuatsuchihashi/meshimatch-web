// ============================================================
// MeshiMatch – ○× 投票 API
// ============================================================
// POST /api/groups/votes – 1票を upsert (再タップで上書き)
// GET  /api/groups/votes?group_id=xxx – 集計
//
// プライバシー方針: 誰がどっちに入れたかは返さない。
// 返すのは店ごとの ○/× 数と、投票済みメンバーIDの集合だけ。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface VoteRow {
  id: string;
  group_id: string;
  member_id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  genre_id: string | null;
  vote: "yes" | "no";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  const memberId = searchParams.get("member_id");

  if (!groupId) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("restaurant_votes")
    .select("*")
    .eq("group_id", groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const votes = (data ?? []) as unknown as VoteRow[];

  const tally = new Map<
    string,
    { restaurantId: string; restaurantName: string | null; genreId: string | null; yes: number; no: number }
  >();
  const votedMemberIds = new Set<string>();

  for (const vote of votes) {
    votedMemberIds.add(vote.member_id);
    const entry = tally.get(vote.restaurant_id) ?? {
      restaurantId: vote.restaurant_id,
      restaurantName: vote.restaurant_name,
      genreId: vote.genre_id,
      yes: 0,
      no: 0,
    };
    if (vote.vote === "yes") entry.yes += 1;
    else entry.no += 1;
    tally.set(vote.restaurant_id, entry);
  }

  const ranking = [...tally.values()].sort(
    (a, b) => b.yes - a.yes || a.no - b.no
  );

  // 自分の投票済み restaurantId (再開時のスキップ用)。他人の内訳は返さない
  const myVotedRestaurantIds = memberId
    ? votes.filter((v) => v.member_id === memberId).map((v) => v.restaurant_id)
    : [];

  return NextResponse.json({
    ranking,
    votedMemberCount: votedMemberIds.size,
    votedMemberIds: [...votedMemberIds],
    myVotedRestaurantIds,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { groupId, memberId, restaurantId, restaurantName, genreId, vote } =
    body as {
      groupId?: string;
      memberId?: string;
      restaurantId?: string;
      restaurantName?: string;
      genreId?: string;
      vote?: "yes" | "no";
    };

  if (!groupId || !memberId || !restaurantId || (vote !== "yes" && vote !== "no")) {
    return NextResponse.json(
      { error: "groupId, memberId, restaurantId, vote(yes|no) are required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("restaurant_votes").upsert(
    {
      group_id: groupId,
      member_id: memberId,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName ?? null,
      genre_id: genreId ?? null,
      vote,
    },
    { onConflict: "group_id,member_id,restaurant_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
