// ============================================================
// Google マップ共有リスト インポート API
// ============================================================
// POST { url }                          → プレビュー (副作用なし)
// POST { url, confirm: true, keys: [], visibility } → お気に入り登録
//
// keys は プレビューで返す item.key (cid または name)。
// マッチ済み → 既存台帳へ user_favorite ソースを付ける
// 未マッチだが飲食っぽい → 台帳に新規行を作ってからソースを付ける
// 非公式エンドポイント依存のため、解析に失敗したら 502 を返し、
// フロントは Takeout CSV の案内へフォールバックする。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveListId, fetchSharedList } from "@/lib/gmaps-import/parse";
import { matchPlaces } from "@/lib/gmaps-import/match";
import type { RestaurantRow } from "@/lib/restaurants/pool";
import { isVerified, type VerificationClient } from "@/lib/verification";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, confirm, keys, visibility, pr } = body as {
    url?: string;
    confirm?: boolean;
    keys?: string[];
    visibility?: "public" | "private";
    pr?: boolean;
  };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let parsed;
  try {
    const listId = await resolveListId(url);
    if (!listId) {
      return NextResponse.json(
        { error: "リンクからリストを特定できませんでした", fallback: "takeout" },
        { status: 422 }
      );
    }
    parsed = await fetchSharedList(listId);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    // 非公式エンドポイントが変わった可能性 → Takeout へ誘導
    return NextResponse.json(
      { error: "リストを読み込めませんでした", fallback: "takeout" },
      { status: 502 }
    );
  }

  const supabase = await createServiceClient();
  const { data: gazetteerRows } = await supabase
    .from("restaurants")
    .select("*")
    .eq("closed", false);
  const gazetteer = (gazetteerRows ?? []) as unknown as RestaurantRow[];

  const results = matchPlaces(parsed.places, gazetteer);
  const items = results.map((r) => ({
    key: r.place.cid ?? r.place.name,
    name: r.place.name,
    address: r.place.address,
    matchedRestaurant: r.matched
      ? { id: r.matched.id, name: r.matched.name, area: r.matched.nearest_area }
      : null,
    importableAsNew: r.importableAsNew,
    nearestArea: r.nearestArea,
    // マッチ済み or 新規登録可能なものだけ選択可能 (ホテル等は selectable=false)
    selectable: r.matched !== null || r.importableAsNew,
  }));

  if (!confirm) {
    return NextResponse.json({
      title: parsed.title,
      creator: parsed.creator,
      items,
    });
  }

  // ---- 登録 ----
  const selectedKeys = new Set(keys ?? []);
  const chosen = results.filter((r) =>
    selectedKeys.has(r.place.cid ?? r.place.name)
  );
  const vis = visibility === "public" ? "public" : "private";
  const verified = await isVerified(supabase as unknown as VerificationClient, user.id);
  const disclosedPr = verified && pr === true;
  let imported = 0;

  for (const r of chosen) {
    let restaurantId = r.matched?.id ?? null;

    if (!restaurantId && r.importableAsNew && r.place.lat !== null) {
      const { data: created } = await supabase
        .from("restaurants")
        .insert({
          name: r.place.name,
          lat: r.place.lat,
          lng: r.place.lng,
          nearest_area: r.nearestArea,
          address: r.place.address,
          external_id: r.place.cid ? `gmaps:${r.place.cid}` : null,
        })
        .select()
        .single();
      restaurantId = (created as { id: string } | null)?.id ?? null;
    }

    if (!restaurantId) continue;

    const { error } = await supabase.from("restaurant_sources").upsert(
      {
        restaurant_id: restaurantId,
        source_type: "user_favorite",
        visibility: vis,
        added_by: user.id,
        note: `Google マップ「${parsed.title}」からインポート`,
        pr: disclosedPr,
      },
      { onConflict: "restaurant_id,source_type,added_by" }
    );
    if (!error) imported += 1;
  }

  return NextResponse.json({ imported, total: chosen.length });
}
