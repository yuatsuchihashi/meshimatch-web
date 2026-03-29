// ============================================================
// MeshiMatch – Matching Results API
// ============================================================
// GET /api/groups/results?group_id=xxx – マッチング結果取得
//
// フロー:
//   1. グループのサーベイ回答を取得
//   2. メンバーのプロフィール（苦手ジャンル）を取得
//   3. マッチングエンジンでグループスコアを算出
//   4. 上位ジャンルでHotPepper検索パラメータを生成
//   5. HotPepper APIでレストラン検索
//   6. レストランにmatchScore付与して返す
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  calculateGroupGenreScores,
  getGenreRanking,
  getSearchParams,
  resolveAreas,
  scoreAndRankRestaurants,
} from "@/lib/matching-engine";
import { searchRestaurants } from "@/lib/hotpepper/client";
import type { SurveyResponse, UserProfile, Restaurant } from "@/lib/types";

// HotPepper のエリアコードマッピング（主要エリア）
const AREA_TO_MIDDLE_CODE: Record<string, string> = {
  "渋谷": "Y055",
  "新宿": "Y050",
  "池袋": "Y045",
  "東京": "Y035",
  "品川": "Y060",
  "上野": "Y030",
  "銀座": "Y040",
  "六本木": "Y065",
  "恵比寿": "Y056",
  "目黒": "Y061",
  "秋葉原": "Y033",
  "浅草": "Y025",
  "横浜": "Y200",
  "吉祥寺": "Y070",
  "立川": "Y080",
  "町田": "Y090",
};

export async function GET(request: NextRequest) {
  const { searchParams: params } = new URL(request.url);
  const groupId = params.get("group_id");
  const sortBy = (params.get("sort") as "match" | "rating") ?? "match";

  if (!groupId) {
    return NextResponse.json(
      { error: "group_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // 1. サーベイ回答を取得
  const { data: surveyRows, error: surveyError } = await supabase
    .from("survey_responses")
    .select(`
      *,
      group_members!inner (
        id,
        display_name,
        profile_id
      )
    `)
    .eq("group_id", groupId);

  if (surveyError) {
    return NextResponse.json({ error: surveyError.message }, { status: 500 });
  }

  if (!surveyRows || surveyRows.length === 0) {
    return NextResponse.json(
      { error: "まだアンケートが提出されていません" },
      { status: 400 }
    );
  }

  // SurveyResponse 型に変換
  const surveys: SurveyResponse[] = surveyRows.map((row) => ({
    id: row.id,
    memberName: row.group_members?.display_name ?? "不明",
    memberId: row.member_id,
    tierS: row.tier_s ?? [],
    tierA: row.tier_a ?? [],
    tierB: row.tier_b ?? [],
    disliked: row.disliked ?? [],
    preferredAreas: row.preferred_areas ?? [],
    departureStation: "",
    preferredArea: null,
    submittedAt: new Date(row.submitted_at),
  }));

  // 2. メンバーのプロフィール取得（苦手ジャンル用）
  const profileIds = surveyRows
    .map((r) => r.group_members?.profile_id)
    .filter(Boolean) as string[];

  let profiles: UserProfile[] = [];
  if (profileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);

    profiles = (profileRows ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      dislikedGenres: p.disliked_genres ?? [],
      allergies: p.allergies ?? [],
    }));
  }

  // 3. マッチングエンジンでスコア算出
  const groupGenreScores = calculateGroupGenreScores(surveys, profiles);
  const genreRanking = getGenreRanking(groupGenreScores);
  const resolvedAreas = resolveAreas(surveys);

  // 4. HotPepper検索パラメータ生成
  const { genreCodes, keywords } = getSearchParams(genreRanking, 3);

  // 5. HotPepper APIでレストラン検索
  const restaurants: Restaurant[] = [];

  // エリアコード取得
  const middleAreaCode = resolvedAreas.length > 0
    ? AREA_TO_MIDDLE_CODE[resolvedAreas[0]]
    : undefined;

  try {
    // ジャンルコードごとに検索
    for (const genreCode of genreCodes) {
      const result = await searchRestaurants({
        genre: genreCode,
        middle_area: middleAreaCode,
        count: 10,
      });

      for (const shop of result.shops) {
        restaurants.push({
          id: shop.id,
          name: shop.name,
          genre: shop.genre?.name ?? "",
          genreId: shop.genre?.code ?? "",
          budget: shop.budget?.average ?? "",
          photoUrl: shop.photo?.pc?.l ?? shop.photo?.mobile?.l,
          matchScore: 0,
          rating: 0,
          access: shop.access ?? "",
          hotpepperUrl: shop.urls?.pc,
          hasPrivateRoom: shop.private_room === "あり",
          address: shop.address,
          area: resolvedAreas[0] ?? "",
        });
      }
    }

    // キーワード検索
    for (const keyword of keywords) {
      const result = await searchRestaurants({
        keyword,
        middle_area: middleAreaCode,
        count: 5,
      });

      for (const shop of result.shops) {
        // 重複チェック
        if (restaurants.some((r) => r.id === shop.id)) continue;

        restaurants.push({
          id: shop.id,
          name: shop.name,
          genre: shop.genre?.name ?? "",
          genreId: shop.genre?.code ?? "",
          budget: shop.budget?.average ?? "",
          photoUrl: shop.photo?.pc?.l ?? shop.photo?.mobile?.l,
          matchScore: 0,
          rating: 0,
          access: shop.access ?? "",
          hotpepperUrl: shop.urls?.pc,
          hasPrivateRoom: shop.private_room === "あり",
          address: shop.address,
          area: resolvedAreas[0] ?? "",
        });
      }
    }
  } catch (err) {
    console.error("HotPepper API error:", err);
    // API エラーでも空の結果で続行
  }

  // 6. matchScore 付与 + ソート
  const results = scoreAndRankRestaurants(restaurants, groupGenreScores, sortBy);

  // アレルギー情報を集約（注意喚起用）
  const allAllergies = [...new Set(profiles.flatMap((p) => p.allergies))];

  return NextResponse.json({
    groupGenreScores,
    genreRanking,
    resolvedAreas,
    allergies: allAllergies,
    results: results.map((r) => ({
      ...r.restaurant,
      matchScore: r.matchScore,
      genreScore: r.genreScore,
    })),
    totalRestaurants: results.length,
  });
}
