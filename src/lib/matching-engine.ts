// ============================================================
// MeshiMatch – Matching Engine
// ============================================================

import type {
  Restaurant,
  SessionFocus,
  SurveyResponse,
  UserProfile,
} from "@/lib/types";
import type { GenreScore, MatchResult } from "@/lib/types";

const MUST_PREFERENCE_WEIGHT = 3;
const PREFER_PREFERENCE_WEIGHT = 2;
const OPTIONAL_PREFERENCE_WEIGHT = 1;
// 「避けたい」は強い負のシグナル (1人でも避けたい人がいれば大きく沈む)
const AVOID_PREFERENCE_WEIGHT = -4;

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

const DEFAULT_GENRE_CODES_BY_FOCUS: Record<NonNullable<SessionFocus>, string[]> = {
  balanced: ["G001", "G004", "G005"],
  drink_centered: ["G001", "G002", "G012"],
  food_centered: ["G004", "G005", "G006"],
};

// ジャンルIDをHotPepperコードに変換
function toHpCode(genreId: string): string {
  // すでにG001形式の場合はそのまま
  if (/^G\d{3}$/.test(genreId)) return genreId;
  return GENRE_ID_TO_HP_CODE[genreId] ?? "G015";
}

function preferenceWeight(priority: "must" | "prefer" | "optional" | "avoid") {
  if (priority === "must") return MUST_PREFERENCE_WEIGHT;
  if (priority === "prefer") return PREFER_PREFERENCE_WEIGHT;
  if (priority === "avoid") return AVOID_PREFERENCE_WEIGHT;
  return OPTIONAL_PREFERENCE_WEIGHT;
}

function hasStructuredPositiveSignals(survey: SurveyResponse) {
  return (survey.genrePreferences?.length ?? 0) > 0;
}

function applyGenreDelta(rawScores: Record<string, number>, genreId: string, delta: number) {
  const code = toHpCode(genreId);
  rawScores[code] = (rawScores[code] ?? 0) + delta;
}

function applyStructuredPositiveScores(
  rawScores: Record<string, number>,
  preferences: NonNullable<SurveyResponse["genrePreferences"]> | NonNullable<UserProfile["favoriteGenres"]>
) {
  for (const preference of preferences) {
    applyGenreDelta(rawScores, preference.genreId, preferenceWeight(preference.priority));
  }
}

/**
 * グループ全体のジャンルスコアを計算する
 */
export function calculateGroupGenreScores(
  surveys: SurveyResponse[],
  profiles: UserProfile[] = []
): Record<string, GenreScore> {
  const rawScores: Record<string, number> = {};
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  // survey があればそれを優先し、空欄のみ profile default で補う
  for (const survey of surveys) {
    const profile = survey.memberId ? profileById.get(survey.memberId) : undefined;

    if (hasStructuredPositiveSignals(survey)) {
      applyStructuredPositiveScores(rawScores, survey.genrePreferences ?? []);
    } else if ((profile?.favoriteGenres?.length ?? 0) > 0) {
      applyStructuredPositiveScores(rawScores, profile?.favoriteGenres ?? []);
    }
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
  topN: number,
  sessionFocus?: SessionFocus | null
): { genreCodes: string[]; keywords: string[] } {
  const positive = genreRanking.filter((g) => g.score > 0).slice(0, topN);
  const genreCodes =
    positive.length > 0
      ? positive.map((g) => g.genreId)
      : [...DEFAULT_GENRE_CODES_BY_FOCUS[sessionFocus ?? "balanced"]];
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
  sortBy: "match" | "rating" = "match"
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
