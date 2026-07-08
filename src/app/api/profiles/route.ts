// ============================================================
// MeshiMatch – Profile API
// ============================================================
// POST /api/profiles – プロフィール作成 or 更新 (upsert)
// GET  /api/profiles?id=xxx – プロフィール取得
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function buildProfilePayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if (body.displayName !== undefined) payload.display_name = body.displayName;
  if (body.bio !== undefined) payload.bio = body.bio;
  if (body.allergyNote !== undefined) payload.allergy_note = body.allergyNote;
  if (body.dietaryNote !== undefined) payload.dietary_note = body.dietaryNote;
  if (body.usualPreferMoods !== undefined) payload.usual_prefer_moods = body.usualPreferMoods;
  if (body.usualAvoidMoods !== undefined) payload.usual_avoid_moods = body.usualAvoidMoods;
  if (body.allergies !== undefined) payload.allergies = body.allergies;
  if (body.avatarUrl !== undefined) payload.avatar_url = body.avatarUrl;
  if (body.usualBudgetIdealYen !== undefined) {
    payload.usual_budget_ideal_yen = body.usualBudgetIdealYen;
  }
  if (body.usualBudgetMaxYen !== undefined) {
    payload.usual_budget_max_yen = body.usualBudgetMaxYen;
  }
  if (body.usualBudgetPriority !== undefined) {
    payload.usual_budget_priority = body.usualBudgetPriority;
  }
  if (body.usualAreas !== undefined) payload.usual_areas = body.usualAreas;
  if (body.favoriteGenres !== undefined) payload.favorite_genres = body.favoriteGenres;
  if (body.dislikedItems !== undefined) payload.disliked_items = body.dislikedItems;
  if (body.dietaryRestrictions !== undefined) {
    payload.dietary_restrictions = body.dietaryRestrictions;
  }

  return payload;
}

// ----- GET: プロフィール取得 -----
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ profile: data });
}

// ----- POST: プロフィール作成 / 更新 -----
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id } = body;

  const supabase = await createServiceClient();
  const payload = buildProfilePayload(body);

  if (id) {
    // 更新
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ profile: data });
  } else {
    // 新規作成
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        display_name: "ユーザー",
        allergies: [],
        ...payload,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ profile: data }, { status: 201 });
  }
}
