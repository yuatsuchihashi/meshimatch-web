// ============================================================
// MeshiMatch – Matching Engine
// ============================================================

import type {
  PriorityLevel,
  Restaurant,
  SessionFocus,
  SurveyResponse,
  UserProfile,
} from "@/lib/types";
import type { GenreScore, MatchResult } from "@/lib/types";

// --- Weight constants ---
// Positive buckets: prioritize=+3, nice_to_have=+2, open_to_it=+1
// Negative buckets: rather_not=-1, prefer_avoid=-2, definitely_avoid=-3

const PRIORITY_WEIGHTS: Record<string, number> = {
  must: 3,
  prefer: 2,
  optional: 1,
  rather_not: -1,
  prefer_avoid: -2,
  definitely_avoid: -3,
};

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
  curry: "G009",
  sushi: "G004",
  soba: "G004",
  yakitori: "G004",
  seafood: "G004",
  nabe: "G004",
  steak: "G005",
};

// サブジャンルのキーワード補完マッピング
// HotPepperコードだけでは区別できないサブジャンルをkeyword検索で補完
const GENRE_ID_TO_KEYWORD: Record<string, string> = {
  sushi: "寿司",
  soba: "そば 蕎麦",
  yakitori: "焼き鳥",
  seafood: "海鮮 魚介",
  nabe: "鍋",
  steak: "ステーキ",
  curry: "カレー",
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
  if (/^G\d{3}$/.test(genreId)) return genreId;
  return GENRE_ID_TO_HP_CODE[genreId] ?? "G015";
}

function preferenceWeight(priority: string): number {
  return PRIORITY_WEIGHTS[priority] ?? 0;
}

function hasGenreSignals(survey: SurveyResponse) {
  return (survey.genrePreferences?.length ?? 0) > 0;
}

function applyGenreDelta(rawScores: Record<string, number>, genreId: string, delta: number) {
  const code = toHpCode(genreId);
  rawScores[code] = (rawScores[code] ?? 0) + delta;
}

function applyGenrePreferences(
  rawScores: Record<string, number>,
  preferences: { genreId: string; priority: string }[],
  keywordVotes: Map<string, number>
) {
  for (const pref of preferences) {
    const weight = preferenceWeight(pref.priority);
    applyGenreDelta(rawScores, pref.genreId, weight);

    // Track sub-genre keyword votes (only for positive preferences)
    const keyword = GENRE_ID_TO_KEYWORD[pref.genreId];
    if (keyword && weight > 0) {
      keywordVotes.set(keyword, (keywordVotes.get(keyword) ?? 0) + weight);
    }
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
  const keywordVotes = new Map<string, number>();
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  for (const survey of surveys) {
    const profile = survey.memberId ? profileById.get(survey.memberId) : undefined;

    if (hasGenreSignals(survey)) {
      applyGenrePreferences(rawScores, survey.genrePreferences ?? [], keywordVotes);
    } else if ((profile?.favoriteGenres?.length ?? 0) > 0) {
      applyGenrePreferences(rawScores, profile?.favoriteGenres ?? [], keywordVotes);
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

// Module-level keyword storage for getSearchParams to access
let _lastKeywordVotes = new Map<string, number>();

/**
 * キーワード投票を取得するためのラッパー
 */
export function calculateGroupGenreScoresWithKeywords(
  surveys: SurveyResponse[],
  profiles: UserProfile[] = []
): { scores: Record<string, GenreScore>; keywordVotes: Map<string, number> } {
  const rawScores: Record<string, number> = {};
  const keywordVotes = new Map<string, number>();
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  for (const survey of surveys) {
    const profile = survey.memberId ? profileById.get(survey.memberId) : undefined;

    if (hasGenreSignals(survey)) {
      applyGenrePreferences(rawScores, survey.genrePreferences ?? [], keywordVotes);
    } else if ((profile?.favoriteGenres?.length ?? 0) > 0) {
      applyGenrePreferences(rawScores, profile?.favoriteGenres ?? [], keywordVotes);
    }
  }

  const maxAbs = Math.max(1, ...Object.values(rawScores).map(Math.abs));
  const scores: Record<string, GenreScore> = {};
  for (const [code, score] of Object.entries(rawScores)) {
    const normalized = (score / maxAbs + 1) / 2;
    scores[code] = {
      genreId: code,
      genreName: HP_GENRE_NAMES[code] ?? code,
      score: score / maxAbs,
      normalizedScore: normalized,
    };
  }

  _lastKeywordVotes = keywordVotes;
  return { scores, keywordVotes };
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
 * score < 0 のジャンルは検索対象から除外
 */
export function getSearchParams(
  genreRanking: GenreScore[],
  topN: number,
  sessionFocus?: SessionFocus | null,
  keywordVotes?: Map<string, number>
): { genreCodes: string[]; keywords: string[] } {
  const positive = genreRanking.filter((g) => g.score > 0).slice(0, topN);
  const negative = new Set(genreRanking.filter((g) => g.score < 0).map((g) => g.genreId));

  const genreCodes =
    positive.length > 0
      ? positive.map((g) => g.genreId).filter((code) => !negative.has(code))
      : DEFAULT_GENRE_CODES_BY_FOCUS[sessionFocus ?? "balanced"]
          .filter((code) => !negative.has(code));

  // Build keywords from sub-genre votes
  const votes = keywordVotes ?? _lastKeywordVotes;
  const keywords = [...votes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw);

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
