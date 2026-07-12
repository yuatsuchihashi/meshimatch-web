import { describe, expect, it } from "vitest";
import { evaluateLabels, formatEvalResult } from "./eval-core.mjs";

const options = { okThreshold: 0.35, badThreshold: 0.65 };

describe("eval-labels", () => {
  it("buckets risk into a 3x3 matrix and computes bad recall", () => {
    const scores = [
      score("a", "A", 0.1, []),
      score("b", "B", 0.4, ["待ち時間"]),
      score("c", "C", 0.7, ["不衛生"]),
      score("d", "D", 0.2, []),
    ];
    const labels = [
      label("a", "A", "good"),
      label("b", "B", "ok"),
      label("c", "C", "bad"),
      label("d", "D", "bad"),
    ];

    const result = evaluateLabels(scores, labels, options);

    expect(result.matrix).toEqual({
      good: { good: 1, ok: 0, bad: 0 },
      ok: { good: 0, ok: 1, bad: 0 },
      bad: { good: 1, ok: 0, bad: 1 },
    });
    expect(result.badRecall).toBe(0.5);
    expect(result.badDetected).toBe(1);
    expect(result.badTotal).toBe(2);
  });

  it("lists disagreements with fired negative reasons", () => {
    const result = evaluateLabels(
      [score("a", "A", 0.8, ["接客が悪い", "不衛生"])],
      [label("a", "A", "good")],
      options
    );

    expect(result.disagreements).toEqual([
      {
        external_id: "a",
        place_id: "a",
        name: "A",
        label: "good",
        risk_bucket: "bad",
        hazure_risk: 0.8,
        negatives: ["接客が悪い", "不衛生"],
      },
    ]);
    expect(formatEvalResult(result, options)).toContain(
      "A (a): label=good, bucket=bad, risk=0.80, reasons=接客が悪い, 不衛生"
    );
  });
});

function score(externalId, name, hazureRisk, negatives) {
  return {
    place_id: externalId,
    external_id: externalId,
    name,
    hazure_risk: hazureRisk,
    group_fit_tags: [],
    negatives,
    computed_at: "2026-07-12T00:00:00.000Z",
    engine_version: "test",
  };
}

function label(externalId, name, value) {
  return {
    external_id: externalId,
    place_id: externalId,
    name,
    label: value,
    memo: "",
    labeled_at: "2026-07-12T00:00:00.000Z",
  };
}
