import { describe, expect, test } from "vitest";
import {
  aggregateBudgetSignals,
  BUDGET_TIERS,
  parseBudgetText,
  scoreBudgetFit,
} from "../recommendation/restaurants";

describe("aggregateBudgetSignals (lower-weighted average)", () => {
  test("3 people: lower budgets weighted more heavily", () => {
    // [3500, 4000, 5000] → sorted desc [5000, 4000, 3500]
    // weights: [1/6, 2/6, 3/6]
    // 5000*1/6 + 4000*2/6 + 3500*3/6 = 3917
    // nearest tier to 3917 = 3000 (diff 917 < diff to 5000 which is 1083)
    const result = aggregateBudgetSignals([
      { ceiling: 3500 },
      { ceiling: 4000 },
      { ceiling: 5000 },
    ]);
    expect(result.respondentCount).toBe(3);
    expect(result.weightedBudget).toBe(3917);
    expect(result.medianTier).toBe(3000);
    expect(result.toleranceLower).toBe(2000);
    expect(result.toleranceUpper).toBe(5000);
    expect(result.minCeiling).toBe(3500);
    expect(result.hasVariance).toBe(false); // 3917 - 3500 = 417 < 2000
  });

  test("variance detected when spread is large", () => {
    // [2000, 3000, 8000] → sorted desc [8000, 3000, 2000]
    // 8000*1/6 + 3000*2/6 + 2000*3/6 = 3333
    // 3333 - 2000 = 1333 < 2000 → no variance
    // Need bigger spread: [1000, 3000, 10000]
    // sorted desc [10000, 3000, 1000]
    // 10000*1/6 + 3000*2/6 + 1000*3/6 = 3167
    // 3167 - 1000 = 2167 >= 2000 → variance!
    const result = aggregateBudgetSignals([
      { ceiling: 1000 },
      { ceiling: 3000 },
      { ceiling: 10000 },
    ]);
    expect(result.minCeiling).toBe(1000);
    expect(result.hasVariance).toBe(true);
  });

  test("single respondent", () => {
    const result = aggregateBudgetSignals([{ ceiling: 4000 }]);
    expect(result.respondentCount).toBe(1);
    expect(result.weightedBudget).toBe(4000);
    expect(result.medianTier).toBe(3000); // nearest tier to 4000
    expect(result.hasVariance).toBe(false);
  });

  test("no respondents", () => {
    const result = aggregateBudgetSignals([]);
    expect(result.respondentCount).toBe(0);
    expect(result.weightedBudget).toBeNull();
    expect(result.hasVariance).toBe(false);
  });

  test("null ceilings excluded", () => {
    const result = aggregateBudgetSignals([
      { ceiling: null },
      { ceiling: 3000 },
      { ceiling: null },
    ]);
    expect(result.respondentCount).toBe(1);
    expect(result.weightedBudget).toBe(3000);
  });
});

describe("scoreBudgetFit (continuous distance-based)", () => {
  // ceilings [3500, 4000, 5000] → weighted=3917, tier=3000, tolerance=[2000, 5000]
  const agg = aggregateBudgetSignals([
    { ceiling: 3500 },
    { ceiling: 4000 },
    { ceiling: 5000 },
  ]);

  test("within tolerance band scores 1.0", () => {
    const result = scoreBudgetFit({ minYen: 3500, maxYen: 4500 }, agg);
    expect(result.score).toBe(1.0);
    expect(result.reasons).toContain("budget_overlap");
  });

  test("at band edge scores 1.0", () => {
    const result = scoreBudgetFit({ minYen: 2000, maxYen: 2000 }, agg);
    expect(result.score).toBe(1.0);
  });

  test("500 yen below band scores 0.5", () => {
    // tolerance lower=2000, restaurant mid=1500 → dist=500
    const result = scoreBudgetFit({ minYen: 1500, maxYen: 1500 }, agg);
    expect(result.score).toBe(0.5);
    expect(result.reasons).toContain("budget_safe");
  });

  test("500 yen above band scores 0.5", () => {
    // tolerance upper=5000, restaurant mid=5500 → dist=500
    const result = scoreBudgetFit({ minYen: 5500, maxYen: 5500 }, agg);
    expect(result.score).toBe(0.5);
    expect(result.reasons).toContain("budget_safe");
  });

  test("1000+ yen outside band scores 0.0", () => {
    // tolerance upper=5000, restaurant mid=6500 → dist=1500
    const result = scoreBudgetFit({ minYen: 6500, maxYen: 6500 }, agg);
    expect(result.score).toBe(0.0);
  });

  test("no respondents returns neutral 0.5", () => {
    const empty = aggregateBudgetSignals([]);
    const result = scoreBudgetFit({ minYen: 3000, maxYen: 4000 }, empty);
    expect(result.score).toBe(0.5);
  });

  test("null restaurant budget returns neutral 0.5", () => {
    const result = scoreBudgetFit({ minYen: null, maxYen: null }, agg);
    expect(result.score).toBe(0.5);
  });
});

describe("parseBudgetText", () => {
  test("parses range format", () => {
    const result = parseBudgetText("3001〜4000円");
    expect(result.minYen).toBe(3001);
    expect(result.maxYen).toBe(4000);
  });

  test("parses single value", () => {
    const result = parseBudgetText("¥2,500");
    expect(result.minYen).toBe(2500);
    expect(result.maxYen).toBe(2500);
  });

  test("handles null input", () => {
    const result = parseBudgetText(null);
    expect(result.minYen).toBeNull();
    expect(result.maxYen).toBeNull();
  });
});
