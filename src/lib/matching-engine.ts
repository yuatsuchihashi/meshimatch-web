// ============================================================
// MeshiMatch – Matching Engine
// ============================================================

import type { SurveyResponse, UserProfile, Restaurant } from "@/lib/types";
import type { GenreScore, MatchResult } from "@/lib/types";

// スコアウェイト
const TIER_S_WEIGHT = 3;
const TIER_A_WEIGHT = 2;
const TIER_B_WEIGHT = 1;
const DISLIKED_PENALTY = -2;

// 内部ジャンルID → HotPepper ジャンルコードのマッピング
const GENRE_ID_TO_HP_CODE: Record<string, string> = {
  izakaya: "G001",
  dining_bar: "G002",
  creative: "G003",
  japanese: "G004",
  western: "G005",
  italian_french: "G006",
  chinese: "G007",
  yakiniku: "G008",
  asian: "G009",
  international: "G010",
  karaoke: "G011",
  bar: "G012",
  ramen: "G013",
  cafe: "G014",
  other: "G015",
  okonomiyaki: "G016",
  korean: "G017",
  curry: "G009", // アジア料理として扱う
  sushi: "G004",
  soba: "G004",
  yakitori: "G004",
  seafood: "G004",
  nabe: "G004",
  steak: "G005",
};

// HotPepper ジャンルコード → 名前
const HP_GENRE_NAMES: Record<string, string> = {
  G001: "居酒屋",
  G002: "ダイニングバー・バル",
  G003: "創作料理",
  G004: "和食",
  G005: "洋食",
  G006: "イタリアン・フレンチ",
  G007: "中華",
  G008: "焼肉・ホルモン",
  G009: "アジア・エスニック料理",
  G010: "各国料理",
  G011: "カラオケ・パーティ",
  G012: "バー・カクテル",
  G013: "ラーメン",
  G014: "カフェ・スイーツ",
  G015: "その他グルメ",
  G016: "お好み焼き・もんじゃ",
  G017: "韓国料理",
};

// ジャンルIDをHotPepperコードに変換
function toHpCode(genreId: string): string {
  // すでにG001形式の場合はそのまま
  if (/^G\d{3}$/.test(genreId)) return genreId;
  return GENRE_ID_TO_HP_CODE[genreId] ?? "G015";
}

/**
 * グループ全体のジャンルスコアを計算する
 */
export function calculateGroupGenreScores(
  surveys: SurveyResponse[],
  profiles: UserProfile[]
): Record<string, GenreScore> {
  const rawScores: Record<string, number> = {};

  // 苦手ジャンルをプロフィールから集める
  const dislikedSet = new Set<string>();
  for (const p of profiles) {
    for (const g of p.dislikedGenres) {
      dislikedSet.add(toHpCode(g));
    }
  }

  // 各サーベイのティアからスコアを集計
  for (const survey of surveys) {
    for (const g of survey.tierS) {
      const code = toHpCode(g);
      rawScores[code] = (rawScores[code] ?? 0) + TIER_S_WEIGHT;
    }
    for (const g of survey.tierA) {
      const code = toHpCode(g);
      rawScores[code] = (rawScores[code] ?? 0) + TIER_A_WEIGHT;
    }
    for (const g of survey.tierB) {
      const code = toHpCode(g);
      rawScores[code] = (rawScores[code] ?? 0) + TIER_B_WEIGHT;
    }
    for (const g of survey.disliked ?? []) {
      const code = toHpCode(g);
      rawScores[code] = (rawScores[code] ?? 0) + DISLIKED_PENALTY;
    }
  }

  // 苦手ジャンルにペナルティ追加
  for (const code of dislikedSet) {
    rawScores[code] = (rawScores[code] ?? 0) + DISLIKED_PENALTY * surveys.length;
  }

  // 正規化 (-1.0 ~ +1.0)
  const maxAbs = Math.max(1, ...Object.values(rawScores).map(Math.abs));
  const result: Record<string, GenreScore> = {};
  for (const [code, score] of Object.entries(rawScores)) {
    const normalized = (score / maxAbs + 1) / 2; // 0.0 ~ 1.0
    result[code] = {
      genreId: code,
      genreName: HP_GENRE_NAMES[code] ?? code,
      score: score / maxAbs,
      normalizedScore: normalized,
    };
  }

  return result;
}

/**
 * ジャンルスコアをスコア降順にソートしたランキングを返す
 */
export function getGenreRanking(
  groupGenreScores: Record<string, GenreScore>
): GenreScore[] {
  return Object.values(groupGenreScores).sort((a, b) => b.score - a.score);
}

/**
 * 上位ジャンルからHotPepper検索パラメータを生成する
 */
export function getSearchParams(
  genreRanking: GenreScore[],
  topN: number
): { genreCodes: string[]; keywords: string[] } {
  const positive = genreRanking.filter((g) => g.score > 0).slice(0, topN);
  const genreCodes = positive.map((g) => g.genreId);
  const keywords: string[] = [];
  return { genreCodes, keywords };
}

/**
 * サーベイ回答から希望エリアを解決する
 */
export function resolveAreas(surveys: SurveyResponse[]): string[] {
  const areaCounts: Record<string, number> = {};

  for (const survey of surveys) {
    const areas = survey.preferredAreas ?? (survey.preferredArea ? [survey.preferredArea] : []);
    for (const area of areas) {
      if (area) areaCounts[area] = (areaCounts[area] ?? 0) + 1;
    }
  }

  // 投票数の多い順にソート
  return Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);
}

/**
 * レストランにマッチスコアを付与してランキングを返す
 */
export function scoreAndRankRestaurants(
  restaurants: Restaurant[],
  groupGenreScores: Record<string, GenreScore>,
  sortBy: "match" | "rating"
): MatchResult[] {
  const results: MatchResult[] = restaurants.map((restaurant) => {
    const genreScore = groupGenreScores[restaurant.genreId];
    const rawGenreScore = genreScore?.score ?? 0;
    const normalizedGenreScore = genreScore?.normalizedScore ?? 0.5;
    const matchScore = Math.max(0, Math.min(1, normalizedGenreScore));

    return {
      restaurant,
      matchScore,
      genreScore: rawGenreScore,
    };
  });

  if (sortBy === "rating") {
    results.sort((a, b) => b.restaurant.rating - a.restaurant.rating);
  } else {
    results.sort((a, b) => b.matchScore - a.matchScore);
  }

  return results;
}
