import { describe, expect, test } from "vitest";
import {
  aggregateBudgetSignals,
  BUDGET_TIERS,
  parseBudgetText,
  scoreBudgetFit,
} from "../recommendation/restaurants";

describe("aggregateBudgetSignals (v2 tier-based)", () => {
  test("computes median and ±1 tier band", () => {
    const result = aggregateBudgetSignals([
      { tier: 2000 },
      { tier: 3000 },
      { tier: 3000 },
      { tier: 5000 },
    ]);
    expect(result.respondentCount).toBe(4);
    expect(result.medianTier).toBe(3000);
    expect(result.toleranceLower).toBe(2000);
    expect(result.toleranceUpper).toBe(5000);
  });

  test("single respondent still expands ±1 tier", () => {
    const result = aggregateBudgetSignals([{ tier: 2000 }]);
    expect(result.medianTier).toBe(2000);
    expect(result.toleranceLower).toBe(1000);
    expect(result.toleranceUpper).toBe(3000);
  });

  test("all same answer", () => {
    const result = aggregateBudgetSignals([
      { tier: 5000 },
      { tier: 5000 },
      { tier: 5000 },
    ]);
    expect(result.medianTier).toBe(5000);
    expect(result.toleranceLower).toBe(3000);
    expect(result.toleranceUpper).toBe(8000);
  });

  test("lowest tier clamps lower bound", () => {
    const result = aggregateBudgetSignals([{ tier: 1000 }]);
    expect(result.medianTier).toBe(1000);
    expect(result.toleranceLower).toBe(1000);
    expect(result.toleranceUpper).toBe(2000);
  });

  test("highest tier clamps upper bound", () => {
    const result = aggregateBudgetSignals([{ tier: 8000 }]);
    expect(result.medianTier).toBe(8000);
    expect(result.toleranceLower).toBe(5000);
    expect(result.toleranceUpper).toBe(8000);
  });

  test("no respondents returns neutral", () => {
    const result = aggregateBudgetSignals([]);
    expect(result.respondentCount).toBe(0);
    expect(result.medianTier).toBeNull();
  });

  test("null tiers are excluded", () => {
    const result = aggregateBudgetSignals([
      { tier: null },
      { tier: 3000 },
      { tier: null },
    ]);
    expect(result.respondentCount).toBe(1);
    expect(result.medianTier).toBe(3000);
  });
});

describe("scoreBudgetFit (v2 tier-based)", () => {
  const aggregate3000 = aggregateBudgetSignals([
    { tier: 2000 },
    { tier: 3000 },
    { tier: 3000 },
    { tier: 5000 },
  ]);

  test("restaurant within ±20% of ideal scores 1.0", () => {
    const result = scoreBudgetFit(
      { minYen: 2500, maxYen: 3500 },
      aggregate3000
    );
    expect(result.score).toBe(1.0);
    expect(result.reasons).toContain("budget_overlap");
  });

  test("restaurant at exact ideal scores 1.0", () => {
    const result = scoreBudgetFit(
      { minYen: 3000, maxYen: 3000 },
      aggregate3000
    );
    expect(result.score).toBe(1.0);
  });

  test("restaurant within ±1 tier band scores 0.5", () => {
    const result = scoreBudgetFit(
      { minYen: 4500, maxYen: 5000 },
      aggregate3000
    );
    expect(result.score).toBe(0.5);
    expect(result.reasons).toContain("budget_safe");
  });

  test("restaurant outside band scores 0.0", () => {
    const result = scoreBudgetFit(
      { minYen: 7000, maxYen: 9000 },
      aggregate3000
    );
    expect(result.score).toBe(0.0);
    expect(result.reasons).toHaveLength(0);
  });

  test("no respondents returns neutral 0.5", () => {
    const empty = aggregateBudgetSignals([]);
    const result = scoreBudgetFit({ minYen: 3000, maxYen: 4000 }, empty);
    expect(result.score).toBe(0.5);
  });

  test("unparseable restaurant budget returns neutral 0.5", () => {
    const result = scoreBudgetFit(
      { minYen: null, maxYen: null },
      aggregate3000
    );
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
