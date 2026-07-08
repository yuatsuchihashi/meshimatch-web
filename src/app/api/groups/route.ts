// ============================================================
// MeshiMatch – Groups API
// ============================================================
// POST   /api/groups – グループ作成
// GET    /api/groups?id=xxx – グループ詳細取得
// GET    /api/groups?profile_id=xxx – 自分のグループ一覧
// PATCH  /api/groups – グループ状態更新
// DELETE /api/groups – グループ削除(幹事) or グループ退出(メンバー)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { nanoid } from "@/lib/utils/nanoid";

// ----- GET: グループ取得 -----
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const profileId = searchParams.get("profile_id");

  const supabase = await createServiceClient();

  // 1つのグループ詳細
  if (id) {
    const { data: group, error } = await supabase
      .from("groups")
      .select(`
        *,
        group_members (
          id,
          profile_id,
          display_name,
          role,
          has_survey
        ),
        survey_responses (
          id,
          member_id,
          response_version,
          departure_area,
          departure_station,
          preferred_areas,
          budget_ideal_yen,
          budget_max_yen,
          budget_priority,
          genre_preferences,
          dietary_restrictions,
          submitted_at
        ),
        decisions (
          id,
          restaurant_name,
          restaurant_id,
          genre_id,
          decided_by,
          decided_at
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ group });
  }

  // 自分のグループ一覧
  if (profileId) {
    // まず自分が所属してるグループIDを取得
    const { data: memberships, error: memberError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", profileId);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    const groupIds = memberships?.map((m) => m.group_id) ?? [];
    if (groupIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const { data: groups, error: groupError } = await supabase
      .from("groups")
      .select(`
        *,
        group_members (
          id,
          profile_id,
          display_name,
          role,
          has_survey
        ),
        decisions (
          restaurant_name,
          restaurant_id,
          decided_at
        )
      `)
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (groupError) {
      return NextResponse.json({ error: groupError.message }, { status: 500 });
    }

    return NextResponse.json({ groups });
  }

  return NextResponse.json(
    { error: "id or profile_id is required" },
    { status: 400 }
  );
}

// ----- POST: グループ作成 -----
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, createdBy, displayName } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const inviteCode = nanoid(8);

  // グループ作成
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name,
      invite_code: inviteCode,
      created_by: createdBy ?? null,
    })
    .select()
    .single();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  // 作成者をownerとしてメンバーに追加
  const { error: memberError } = await supabase
    .from("group_members")
    .insert({
      group_id: group.id,
      profile_id: createdBy ?? null,
      display_name: displayName ?? "ホスト",
      role: "owner",
    });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ group }, { status: 201 });
}

// ----- PATCH: グループ状態更新 -----
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { groupId, profileId, status } = body as {
    groupId: string;
    profileId: string;
    status: "active" | "archived";
  };

  if (!groupId || !profileId || !status) {
    return NextResponse.json(
      { error: "groupId, profileId, and status are required" },
      { status: 400 }
    );
  }

  if (status !== "active" && status !== "archived") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "あなたはこのグループのメンバーではありません" },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from("groups")
    .update({ status })
    .eq("id", groupId);

  if (updateError) {
    console.error("[PATCH group] error:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, groupId, status });
}

// ----- DELETE: グループ削除 or 退出 -----
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { groupId, profileId, action } = body as {
    groupId: string;
    profileId: string;
    action: "delete" | "leave";
  };

  if (!groupId || !profileId || !action) {
    return NextResponse.json(
      { error: "groupId, profileId, and action are required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // まず自分のメンバーシップを確認
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("id, role")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "あなたはこのグループのメンバーではありません" },
      { status: 403 }
    );
  }

  if (action === "delete") {
    // 幹事のみグループ削除可能
    if (membership.role !== "owner") {
      return NextResponse.json(
        { error: "グループの削除は幹事のみ可能です" },
        { status: 403 }
      );
    }

    // 関連データを先に削除（カスケードに頼らず明示的に）
    await supabase.from("decisions").delete().eq("group_id", groupId);
    await supabase.from("survey_responses").delete().eq("group_id", groupId);
    await supabase.from("invitations").delete().eq("group_id", groupId);
    await supabase.from("group_members").delete().eq("group_id", groupId);

    // グループ本体を削除
    const { error: deleteError } = await supabase
      .from("groups")
      .delete()
      .eq("id", groupId);

    if (deleteError) {
      console.error("[DELETE group] error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "deleted" });
  }

  if (action === "leave") {
    // 幹事は退出できない（先にグループ削除を使う）
    if (membership.role === "owner") {
      return NextResponse.json(
        { error: "幹事はグループを退出できません。グループを削除してください。" },
        { status: 400 }
      );
    }

    // 関連するアンケート回答を先に削除
    await supabase
      .from("survey_responses")
      .delete()
      .eq("group_id", groupId)
      .eq("member_id", membership.id);

    // メンバーシップ削除
    const { error: leaveError } = await supabase
      .from("group_members")
      .delete()
      .eq("id", membership.id);

    if (leaveError) {
      console.error("[LEAVE group] error:", leaveError);
      return NextResponse.json({ error: leaveError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "left" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
