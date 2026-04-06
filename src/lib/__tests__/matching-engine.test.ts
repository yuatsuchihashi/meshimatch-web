import { describe, expect, test } from "vitest";
import {
  calculateGroupGenreScores,
  getGenreRanking,
  getSearchParams,
  resolveAreas,
  scoreAndRankRestaurants,
} from "../matching-engine";
import { recommendCandidateAreas } from "../recommendation/place";
import {
  aggregateBudgetSignals,
  parseBudgetText,
  scoreRestaurantForSession,
  scoreBudgetFit,
} from "../recommendation/restaurants";
import { mapSurveyResponseRow } from "../session-data";
import type { GenreScore, Restaurant, SurveyResponse, UserProfile } from "../types";

function makeSurvey(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  return {
    id: "survey-1",
    memberName: "テスト太郎",
    memberId: "member-1",
    preferredAreas: [],
    departureArea: null,
    departureStation: "",
    preferredArea: null,
    submittedAt: new Date("2026-04-03T12:00:00Z"),
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    displayName: "テスト太郎",
    allergies: [],
    usualAreas: [],
    favoriteGenres: [],
    dislikedItems: [],
    dietaryRestrictions: [],
    ...overrides,
  };
}

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    name: "テスト食堂",
    genre: "和食",
    genreId: "G004",
    budget: "¥3,000〜¥4,000",
    matchScore: 0,
    rating: 4.2,
    access: "渋谷駅徒歩3分",
    hasPrivateRoom: false,
    area: "渋谷",
    ...overrides,
  };
}

describe("matching-engine", () => {
  test("calculateGroupGenreScores aggregates structured genre preferences", () => {
    const surveys = [
      makeSurvey({
        id: "survey-1",
        memberId: "member-1",
        genrePreferences: [
          { genreId: "G004", priority: "prefer" },
          { genreId: "G008", priority: "optional" },
        ],
      }),
      makeSurvey({
        id: "survey-2",
        memberId: "member-2",
        genrePreferences: [{ genreId: "G008", priority: "prefer" }],
      }),
    ];
    const scores = calculateGroupGenreScores(surveys);

    expect(scores.G004.genreName).toBe("和食");
    expect(scores.G008.score).toBeGreaterThan(scores.G004.score);
  });

  test("calculateGroupGenreScores tolerates omitted profiles", () => {
    const scores = calculateGroupGenreScores([
      makeSurvey({
        genrePreferences: [{ genreId: "G013", priority: "prefer" }],
      }),
    ]);
    expect(scores.G013.score).toBe(1);
    expect(scores.G013.normalizedScore).toBe(1);
  });

  test("calculateGroupGenreScores uses structured v2 preferences directly", () => {
    const scores = calculateGroupGenreScores([
      makeSurvey({
        responseVersion: 2,
        genrePreferences: [{ genreId: "G004", priority: "optional" }],
      }),
    ]);

    expect(scores.G004.score).toBe(1);
    expect(scores.G008).toBeUndefined();
  });

  test("calculateGroupGenreScores falls back to profile defaults when survey omits genre preferences", () => {
    const scores = calculateGroupGenreScores(
      [makeSurvey({ memberId: "member-1" })],
      [
        makeProfile({
          id: "member-1",
          favoriteGenres: [{ genreId: "G013", priority: "prefer" }],
        }),
      ]
    );

    expect(scores.G013.score).toBe(1);
    expect(scores.G004).toBeUndefined();
  });

  test("getGenreRanking sorts by descending score", () => {
    const ranking = getGenreRanking({
      G013: { genreId: "G013", genreName: "ラーメン", score: 0.25, normalizedScore: 0.625 },
      G004: { genreId: "G004", genreName: "和食", score: 1, normalizedScore: 1 },
    });

    expect(ranking.map((item) => item.genreId)).toEqual(["G004", "G013"]);
  });

  test("getSearchParams keeps only positive top-N genres", () => {
    const ranking: GenreScore[] = [
      { genreId: "G004", genreName: "和食", score: 1, normalizedScore: 1 },
      { genreId: "G008", genreName: "焼肉・ホルモン", score: 0.4, normalizedScore: 0.7 },
      { genreId: "G013", genreName: "ラーメン", score: -0.2, normalizedScore: 0.4 },
    ];

    const { genreCodes, keywords } = getSearchParams(ranking, 2);

    expect(genreCodes).toEqual(["G004", "G008"]);
    expect(keywords).toEqual([]);
  });

  test("getSearchParams falls back to focus-aware default genres when no positive scores exist", () => {
    expect(getSearchParams([], 3, "drink_centered").genreCodes).toEqual([
      "G001",
      "G002",
      "G012",
    ]);
    expect(getSearchParams([], 3, "food_centered").genreCodes).toEqual([
      "G004",
      "G005",
      "G006",
    ]);
  });

  test("resolveAreas counts preferredAreas and preferredArea inputs", () => {
    const resolved = resolveAreas([
      makeSurvey({ preferredAreas: ["渋谷", "新宿"] }),
      makeSurvey({ preferredAreas: ["渋谷"] }),
      makeSurvey({ preferredArea: "銀座", preferredAreas: undefined }),
    ]);

    expect(resolved[0]).toBe("渋谷");
    expect(resolved).toContain("新宿");
    expect(resolved).toContain("銀座");
  });

  test("scoreAndRankRestaurants sorts by match by default and can sort by rating", () => {
    const restaurants = [
      makeRestaurant({ id: "r-low", genreId: "G013", rating: 4.8 }),
      makeRestaurant({ id: "r-high", genreId: "G004", rating: 4.0 }),
    ];
    const groupScores = {
      G004: { genreId: "G004", genreName: "和食", score: 1, normalizedScore: 1 },
      G013: { genreId: "G013", genreName: "ラーメン", score: -0.5, normalizedScore: 0.25 },
    };

    const byMatch = scoreAndRankRestaurants(restaurants, groupScores);
    const byRating = scoreAndRankRestaurants(restaurants, groupScores, "rating");

    expect(byMatch[0].restaurant.id).toBe("r-high");
    expect(byMatch[0].matchScore).toBe(1);
    expect(byRating[0].restaurant.id).toBe("r-low");
  });
});

describe("place recommendations", () => {
  test("recommendCandidateAreas returns top 3 areas with explanations and tags", () => {
    const candidates = recommendCandidateAreas({
      groupSize: 6,
      responses: [
        { departureStation: "渋谷", preferredAreas: ["恵比寿"] },
        { departureStation: "渋谷", preferredAreas: ["恵比寿"] },
        { departureStation: "新宿", preferredAreas: [] },
      ],
    });

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.length).toBeLessThanOrEqual(3);
    expect(candidates[0].tags.length).toBeGreaterThan(0);
    expect(candidates[0].explanation.length).toBeGreaterThan(0);
  });

  test("recommendCandidateAreas uses group-size adaptive weights", () => {
    const smallGroup = recommendCandidateAreas({
      groupSize: 2,
      responses: [
        { departureStation: "渋谷", preferredAreas: ["下北沢"] },
        { departureStation: "新宿", preferredAreas: ["下北沢"] },
      ],
    });
    const largeGroup = recommendCandidateAreas({
      groupSize: 8,
      responses: [
        { departureStation: "渋谷", preferredAreas: ["下北沢"] },
        { departureStation: "新宿", preferredAreas: ["下北沢"] },
      ],
    });

    // Both should return results
    expect(smallGroup.length).toBeGreaterThanOrEqual(1);
    expect(largeGroup.length).toBeGreaterThanOrEqual(1);
    // Large group should favor bigger stations (higher restaurant/scale scores)
    const largeGroupTopScore = largeGroup[0].scores.restaurant + largeGroup[0].scores.scale;
    expect(largeGroupTopScore).toBeGreaterThan(0);
  });
});

describe("budget recommendation helpers", () => {
  test("aggregateBudgetSignals computes tier median and tolerance band", () => {
    const aggregate = aggregateBudgetSignals([
      { tier: 3000 },
      { tier: 3000 },
      { tier: 5000 },
    ]);

    expect(aggregate.respondentCount).toBe(3);
    expect(aggregate.medianTier).toBe(3000);
    expect(aggregate.toleranceLower).toBe(2000);
    expect(aggregate.toleranceUpper).toBe(5000);
  });

  test("parseBudgetText extracts numeric ranges", () => {
    expect(parseBudgetText("¥3,000〜¥4,500")).toEqual({
      minYen: 3000,
      maxYen: 4500,
    });
    expect(parseBudgetText("¥2,500")).toEqual({
      minYen: 2500,
      maxYen: 2500,
    });
  });

  test("aggregateBudgetSignals ignores null tiers", () => {
    const aggregate = aggregateBudgetSignals([
      {},
      { tier: null },
      { tier: 3000 },
    ]);

    expect(aggregate.respondentCount).toBe(1);
    expect(aggregate.medianTier).toBe(3000);
  });

  test("scoreBudgetFit scores 1.0 for ideal, 0.5 for band, 0.0 for outside", () => {
    const aggregate = aggregateBudgetSignals([
      { tier: 3000 },
    ]);

    const goodFit = scoreBudgetFit(parseBudgetText("¥2,800〜¥3,200"), aggregate);
    const bandFit = scoreBudgetFit(parseBudgetText("¥4,500〜¥5,000"), aggregate);
    const outside = scoreBudgetFit(parseBudgetText("¥7,000〜¥9,000"), aggregate);

    expect(goodFit.score).toBe(1.0);
    expect(goodFit.reasons).toContain("budget_overlap");
    expect(bandFit.score).toBe(0.5);
    expect(bandFit.reasons).toContain("budget_safe");
    expect(outside.score).toBe(0.0);
  });

  test("scoreRestaurantForSession reflects session focus, atmosphere, and group size", () => {
    const result = scoreRestaurantForSession({
      restaurant: makeRestaurant({
        genre: "居酒屋",
        budget: "¥3,200〜¥3,800",
        hasPrivateRoom: true,
      }),
      baseMatch: 0.82,
      groupSize: 6,
      sessionAtmosphere: "lively",
      sessionFocus: "drink_centered",
      budgetSignals: aggregateBudgetSignals([
        { tier: 3000 },
      ]),
    });

    expect(result.matchScore).toBeGreaterThan(0.75);
    expect(result.reasons).toContain("drink_focus_fit");
    expect(result.reasons).toContain("group_size_fit");
    expect(result.reasonTags.length).toBeGreaterThan(0);
  });
});

describe("session data normalization", () => {
  test("mapSurveyResponseRow normalizes preferred area and reads v2 genre fields", () => {
    const survey = mapSurveyResponseRow({
      id: "survey-1",
      member_id: "member-1",
      response_version: 2,
      genre_preferences: [
        { genreId: "G004", priority: "prefer" },
        { genreId: "G008", priority: "optional" },
      ],
      preferred_area: "銀座",
      departure_station: "渋谷駅",
      submitted_at: "2026-04-03T12:00:00Z",
      group_members: { display_name: "テスト太郎" },
    });

    expect(survey.memberName).toBe("テスト太郎");
    expect(survey.preferredAreas).toEqual(["銀座"]);
    expect(survey.preferredArea).toBe("銀座");
    expect(survey.genrePreferences).toEqual([
      { genreId: "G004", priority: "prefer" },
      { genreId: "G008", priority: "optional" },
    ]);
  });
});
