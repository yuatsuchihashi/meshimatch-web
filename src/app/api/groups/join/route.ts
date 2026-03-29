// ============================================================
// MeshiMatch – Group Join API
// ============================================================
// POST /api/groups/join – 招待コードでグループに参加
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { inviteCode, profileId, displayName } = body;

  if (!inviteCode) {
    return NextResponse.json(
      { error: "inviteCode is required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // 1. 招待コードでグループを検索
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, status")
    .eq("invite_code", inviteCode)
    .single();

  if (groupError || !group) {
    return NextResponse.json(
      { error: "グループが見つかりません" },
      { status: 404 }
    );
  }

  if (group.status !== "active") {
    return NextResponse.json(
      { error: "このグループは終了しています" },
      { status: 400 }
    );
  }

  // 2. すでにメンバーかチェック
  if (profileId) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "すでにグループに参加しています", group },
        { status: 409 }
      );
    }
  }

  // 3. メンバーとして追加
  const { data: member, error: memberError } = await supabase
    .from("group_members")
    .insert({
      group_id: group.id,
      profile_id: profileId ?? null,
      display_name: displayName ?? "ゲスト",
      role: "member",
    })
    .select()
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json(
    { group, member },
    { status: 201 }
  );
}
