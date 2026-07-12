import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_EVIDENCE_THRESHOLD,
  ENGINE_VERSION,
  buildGroupFitVlmPrompt,
  buildReviewTriagePrompt,
  computeBayesianAverage,
  computeEvidence,
  scoreCatalog,
  scoreGroupFitWithHeuristics,
  scoreGroupFitWithVlm,
  scorePlaceQuality,
  triageReviewsWithKeywords,
  triageReviewsWithLlm,
} from "@/lib/quality/index.mjs";

const scriptPath = path.join(process.cwd(), "scripts/quality/score-catalog.mjs");

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "fixtures/test-place",
    displayName: { text: "テスト食堂" },
    rating: 4.2,
    userRatingCount: 80,
    priceLevel: "PRICE_LEVEL_MODERATE",
    photos: [{ name: "fixtures/photos/test", widthPx: 1000, heightPx: 800 }],
    reviews: [],
    ...overrides,
  };
}

describe("quality bayesian scoring", () => {
  it("shrinks tiny perfect ratings toward the documented prior", () => {
    const result = computeBayesianAverage({ rating: 5, reviewCount: 1 });

    expect(result.average).toBeCloseTo(4.02439, 5);
    expect(result.confidence).toBeCloseTo(1 / 41, 5);
    expect(result.usedInput).toBe(true);
  });

  it("uses the prior when rating or review count is absent", () => {
    expect(computeBayesianAverage({ rating: null, reviewCount: 100 }).average).toBe(4);
    expect(computeBayesianAverage({ rating: 4.8, reviewCount: null }).confidence).toBe(0);
    expect(computeBayesianAverage({ rating: 4.8, reviewCount: 0 }).usedInput).toBe(false);
  });

  it("computes stage-gate evidence from rating times review count", () => {
    const evidence = computeEvidence({ rating: 4.2, reviewCount: 80 });

    expect(evidence).toMatchObject({
      rating: 4.2,
      count: 80,
      raw: 336,
    });
    expect(evidence.bayes).toBeCloseTo(4.133, 3);
  });
});

describe("keyword review triage", () => {
  it("separates heavy operational failures from light waiting/crowding issues", () => {
    const result = triageReviewsWithKeywords([
      "店員さんの態度が悪く、会計も金額が違っていました。",
      "席が汚く衛生面が不安でした。",
      "週末は混雑していて行列で30分待ちました。",
    ]);

    const byCategory = new Map(result.negatives.map((negative) => [negative.category, negative]));
    expect(byCategory.get("service")?.severity).toBe("heavy");
    expect(byCategory.get("hygiene")?.weight).toBe(0.28);
    expect(byCategory.get("billing_trouble")?.severity).toBe("heavy");
    expect(byCategory.get("crowded")?.severity).toBe("light");
    expect(byCategory.get("wait_time")?.weight).toBe(0.07);
  });

  it("only inspects up to five review snippets", () => {
    const result = triageReviewsWithKeywords([
      "問題なし",
      "問題なし",
      "問題なし",
      "問題なし",
      "問題なし",
      "会計トラブルがありました。",
    ]);

    expect(result.negatives).toHaveLength(0);
  });
});

describe("group fit heuristics", () => {
  it("tags group-usable metadata without creating a taste axis", () => {
    const result = scoreGroupFitWithHeuristics(
      place({
        priceLevel: "PRICE_LEVEL_EXPENSIVE",
        reviews: [
          { text: { text: "個室があり、席間がゆったりしていて静かに話しやすいです。" } },
          { text: { text: "大人数の会食にも便利でした。" } },
        ],
      })
    );

    expect(result.group_fit_tags).toEqual(expect.arrayContaining(["予算高め", "個室あり気配", "大人数向き", "静か"]));
    expect(result.group_fit_tags.join(" ")).not.toContain("美味");
  });

  it("marks noisy or small-capacity caveats as group-fit tags", () => {
    const result = scoreGroupFitWithHeuristics(
      place({
        priceLevel: "PRICE_LEVEL_INEXPENSIVE",
        reviews: [{ text: { text: "賑やかで、席数は多くないので大人数は確認が必要です。" } }],
      })
    );

    expect(result.group_fit_tags).toEqual(expect.arrayContaining(["価格読みやすい", "賑やか", "要・大人数確認"]));
  });
});

describe("quality score artifact", () => {
  it("uses stage 1 for enough evidence and skips deep inspection", () => {
    const row = scorePlaceQuality(
      place({
        rating: 4.5,
        userRatingCount: 120,
        priceLevel: "PRICE_LEVEL_EXPENSIVE",
        reviews: [{ text: { text: "接客が悪く、個室もありました。" } }],
      }),
      { computedAt: "2026-07-12T00:00:00.000Z", evidenceThreshold: DEFAULT_EVIDENCE_THRESHOLD }
    );

    expect(row.stage).toBe(1);
    expect(row.evidence).toEqual({ rating: 4.5, count: 120, bayes: 4.375 });
    expect(row.evidence_threshold).toBe(DEFAULT_EVIDENCE_THRESHOLD);
    expect(row.negatives).toHaveLength(0);
    expect(row.group_fit_tags).toEqual(["予算高め"]);
  });

  it("uses stage 2 for thin evidence and runs deep fallback inspection", () => {
    const row = scorePlaceQuality(
      place({
        rating: 4.8,
        userRatingCount: 12,
        reviews: [
          { text: { text: "個室があり、席間がゆったりしています。" } },
          { text: { text: "接客が悪く、会計の金額も違いました。" } },
        ],
      }),
      { computedAt: "2026-07-12T00:00:00.000Z", evidenceThreshold: DEFAULT_EVIDENCE_THRESHOLD }
    );

    expect(row.stage).toBe(2);
    expect(row.evidence).toEqual({ rating: 4.8, count: 12, bayes: 4.185 });
    expect(row.negatives.map((negative) => negative.category)).toEqual(["service", "billing_trouble"]);
    expect(row.group_fit_tags).toEqual(expect.arrayContaining(["個室あり気配", "大人数向き"]));
  });

  it("roundtrips the scores.jsonl row schema", () => {
    const row = scorePlaceQuality(
      place({
        reviews: [{ text: { text: "週末は混雑して少し待ちました。" } }],
      }),
      { computedAt: "2026-07-12T00:00:00.000Z", evidenceThreshold: 1000 }
    );
    const parsed = JSON.parse(JSON.stringify(row));

    expect(parsed).toMatchObject({
      place_id: "fixtures/test-place",
      external_id: "place:fixtures/test-place",
      name: "テスト食堂",
      stage: 2,
      evidence: {
        rating: 4.2,
        count: 80,
        bayes: 4.133,
      },
      evidence_threshold: 1000,
      computed_at: "2026-07-12T00:00:00.000Z",
      engine_version: ENGINE_VERSION,
    });
    expect(parsed.hazure_risk).toBeGreaterThanOrEqual(0);
    expect(parsed.hazure_risk).toBeLessThanOrEqual(1);
    expect(parsed.negatives[0]).toMatchObject({
      category: "crowded",
      severity: "light",
      weight: 0.08,
    });
  });

  it("scores a catalog array", () => {
    const rows = scoreCatalog([place()], { computedAt: "2026-07-12T00:00:00.000Z" });

    expect(rows).toHaveLength(1);
    expect(rows[0].engine_version).toBe(ENGINE_VERSION);
    expect(rows[0].stage).toBe(1);
  });

  it("writes JSONL from the fixture-backed batch script", () => {
    const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "quality-score-")), "scores.jsonl");
    const stdout = execFileSync(
      process.execPath,
      [scriptPath, "--dry-run", "--output", outputPath, "--computed-at", "2026-07-12T00:00:00.000Z"],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          QUALITY_LLM_APPROVED: "",
          QUALITY_VLM_APPROVED: "",
        },
      }
    );
    const summary = JSON.parse(stdout);
    const rows = fs
      .readFileSync(outputPath, "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(summary).toMatchObject({
      dryRun: true,
      count: 8,
      evidence_threshold: DEFAULT_EVIDENCE_THRESHOLD,
      engine_version: ENGINE_VERSION,
    });
    expect(rows).toHaveLength(8);
    expect(rows[0]).toHaveProperty("hazure_risk");
    expect(rows[0]).toHaveProperty("stage");
    expect(rows[0]).toHaveProperty("evidence");
    expect(rows[0]).toHaveProperty("evidence_threshold", DEFAULT_EVIDENCE_THRESHOLD);
    expect(rows[0]).not.toHaveProperty("taste_score");
  });
});

describe("model adapter stubs", () => {
  it("defines review prompt/schema and refuses without approval env", async () => {
    const prompt = buildReviewTriagePrompt({ placeName: "テスト食堂", reviews: ["接客が悪い"] });

    expect(prompt).toContain("Return strict JSON");
    expect(prompt).toContain("service, hygiene, billing_trouble, crowded, wait_time");
    await expect(
      triageReviewsWithLlm({ placeName: "テスト食堂", reviews: ["接客が悪い"] }, { QUALITY_LLM_APPROVED: "" })
    ).rejects.toThrow("QUALITY_LLM_APPROVED=1");
  });

  it("defines group-fit VLM prompt/schema and refuses without approval env", async () => {
    const prompt = buildGroupFitVlmPrompt({
      placeName: "テスト食堂",
      metadata: { photos: [{ name: "fixtures/photos/test" }] },
      reviews: ["個室がありそう"],
    });

    expect(prompt).toContain("Return strict JSON");
    expect(prompt).toContain("Do not score taste");
    await expect(
      scoreGroupFitWithVlm({ placeName: "テスト食堂", metadata: {}, reviews: [] }, { QUALITY_VLM_APPROVED: "" })
    ).rejects.toThrow("QUALITY_VLM_APPROVED=1");
  });
});
