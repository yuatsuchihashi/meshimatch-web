export const ENGINE_VERSION = "r6b-offline-v2-stage-gated-threshold-tunable";

// Prior: 4.0 stars over 40 reviews approximates a decent-but-unproven baseline
// for group dining, preventing "1 review, 5 stars" from looking reliable.
export const DEFAULT_BAYESIAN_PRIOR = Object.freeze({
  mean: 4.0,
  reviewCount: 40,
});

// Evidence is rating x review count, matching the founder's first-pass check:
// "large enough numbers are safe enough after price check; inspect deeply only
// when numbers are thin." Tune this after the R6c 30-label comparison.
export const DEFAULT_EVIDENCE_THRESHOLD = 300;

export const REVIEW_NEGATIVE_CATEGORIES = Object.freeze({
  service: {
    label: "接客",
    severity: "heavy",
    weight: 0.24,
    keywords: [
      "接客が悪",
      "接客悪",
      "店員の態度",
      "店員さんの態度",
      "スタッフの態度",
      "態度が悪",
      "対応が悪",
      "無愛想",
      "不親切",
      "rude service",
      "bad service",
    ],
  },
  hygiene: {
    label: "衛生",
    severity: "heavy",
    weight: 0.28,
    keywords: ["衛生面が不安", "衛生が不安", "汚", "不潔", "臭", "におい", "虫", "hair", "dirty", "smell"],
  },
  billing_trouble: {
    label: "会計トラブル",
    severity: "heavy",
    weight: 0.3,
    keywords: ["会計", "請求", "レシート", "ぼった", "二重", "返金", "金額", "billing", "charged"],
  },
  crowded: {
    label: "混雑",
    severity: "light",
    weight: 0.08,
    keywords: ["混雑", "混ん", "満席", "人が多", "crowded", "packed"],
  },
  wait_time: {
    label: "行列・待ち時間",
    severity: "light",
    weight: 0.07,
    keywords: ["行列", "並", "待ち", "待つ", "待た", "提供が遅", "遅い", "queue", "wait"],
  },
});

const GROUP_FIT_KEYWORDS = Object.freeze({
  privateRoom: ["個室", "半個室", "private room"],
  spacious: ["広い", "広め", "ゆったり", "席間", "大人数", "宴会", "テーブル席", "テーブル予約"],
  quiet: ["静か", "落ち着", "会食", "話しやすい", "照明", "quiet"],
  noisy: ["うるさい", "賑やか", "声が聞き取りづらい", "騒が", "noisy"],
  smallGroup: ["少人数", "席数は多くない", "大人数は確認"],
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function safeText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.text === "string") return value.text;
  return "";
}

export function normalizeReviews(placeOrReviews) {
  const rawReviews = Array.isArray(placeOrReviews) ? placeOrReviews : placeOrReviews?.reviews;
  if (!Array.isArray(rawReviews)) return [];
  return rawReviews.slice(0, 5).map((review, index) => {
    if (typeof review === "string") {
      return { index, rating: null, text: review };
    }
    return {
      index,
      rating: typeof review?.rating === "number" ? review.rating : null,
      text: safeText(review?.text),
      publishTime: typeof review?.publishTime === "string" ? review.publishTime : null,
    };
  });
}

export function computeBayesianAverage(input, prior = DEFAULT_BAYESIAN_PRIOR) {
  const rating = typeof input?.rating === "number" && Number.isFinite(input.rating) ? input.rating : null;
  const reviewCount =
    typeof input?.reviewCount === "number" && Number.isFinite(input.reviewCount)
      ? Math.max(0, Math.floor(input.reviewCount))
      : null;
  const priorMean = clamp(prior.mean, 0, 5);
  const priorCount = Math.max(0, prior.reviewCount);

  if (rating === null || reviewCount === null || reviewCount <= 0) {
    return {
      average: priorMean,
      inputRating: rating,
      inputReviewCount: reviewCount,
      priorMean,
      priorReviewCount: priorCount,
      confidence: 0,
      usedInput: false,
    };
  }

  const boundedRating = clamp(rating, 0, 5);
  const average = (boundedRating * reviewCount + priorMean * priorCount) / (reviewCount + priorCount);
  return {
    average,
    inputRating: boundedRating,
    inputReviewCount: reviewCount,
    priorMean,
    priorReviewCount: priorCount,
    confidence: reviewCount / (reviewCount + priorCount),
    usedInput: true,
  };
}

export function computeEvidence(input, prior = DEFAULT_BAYESIAN_PRIOR) {
  const bayesian = computeBayesianAverage(input, prior);
  const count = bayesian.inputReviewCount ?? 0;
  const rating = bayesian.inputRating;
  return {
    rating,
    count,
    bayes: round3(bayesian.average),
    raw: rating === null ? 0 : round3(rating * count),
    confidence: round3(bayesian.confidence),
    used_input: bayesian.usedInput,
  };
}

export function triageReviewsWithKeywords(reviews) {
  const normalized = normalizeReviews(reviews);
  const negatives = [];

  for (const review of normalized) {
    const text = review.text;
    const lowerText = text.toLowerCase();
    for (const [category, config] of Object.entries(REVIEW_NEGATIVE_CATEGORIES)) {
      const matchedKeyword = config.keywords.find((keyword) => lowerText.includes(keyword.toLowerCase()));
      if (!matchedKeyword) continue;
      negatives.push({
        category,
        label: config.label,
        severity: config.severity,
        weight: config.weight,
        evidence: text,
        matched_keyword: matchedKeyword,
        review_index: review.index,
      });
    }
  }

  return { provider: "keyword-fallback", negatives };
}

export function buildReviewTriagePrompt({ placeName, reviews }) {
  const reviewLines = normalizeReviews(reviews)
    .map((review, index) => `${index + 1}. rating=${review.rating ?? "unknown"} text=${JSON.stringify(review.text)}`)
    .join("\n");
  return [
    "You classify only operational risk for a group dining recommendation engine.",
    "Do not judge cuisine quality, taste, trendiness, or personal preference.",
    "Axis: avoid bad surprises for the organizer and identify group-usage risks.",
    `Place: ${placeName ?? "unknown"}`,
    "Reviews, max 5:",
    reviewLines || "(none)",
    "Return strict JSON matching this schema:",
    JSON.stringify(REVIEW_TRIAGE_JSON_SCHEMA, null, 2),
    "Use categories only: service, hygiene, billing_trouble, crowded, wait_time.",
    "Severity weights: service=0.24, hygiene=0.28, billing_trouble=0.30, crowded=0.08, wait_time=0.07.",
  ].join("\n");
}

export const REVIEW_TRIAGE_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["negatives"],
  properties: {
    negatives: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "severity", "weight", "evidence", "review_index"],
        properties: {
          category: {
            type: "string",
            enum: ["service", "hygiene", "billing_trouble", "crowded", "wait_time"],
          },
          severity: { type: "string", enum: ["heavy", "light"] },
          weight: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string" },
          review_index: { type: "integer", minimum: 0, maximum: 4 },
        },
      },
    },
  },
});

export async function triageReviewsWithLlm(input, env = process.env) {
  if (env.QUALITY_LLM_APPROVED !== "1") {
    throw new Error("LLM review triage is blocked until QUALITY_LLM_APPROVED=1. No SDK wiring exists in R6b.");
  }
  void buildReviewTriagePrompt(input);
  throw new Error("LLM review triage adapter stub only: model selection and SDK wiring are founder-pending.");
}

function containsAny(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

export function scoreGroupFitWithHeuristics(place) {
  const reviewText = normalizeReviews(place)
    .map((review) => review.text)
    .join("\n");
  const tags = new Set();

  if (place?.priceLevel === "PRICE_LEVEL_INEXPENSIVE") tags.add("価格読みやすい");
  if (place?.priceLevel === "PRICE_LEVEL_EXPENSIVE" || place?.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE") {
    tags.add("予算高め");
  }
  if (containsAny(reviewText, GROUP_FIT_KEYWORDS.privateRoom)) tags.add("個室あり気配");
  if (containsAny(reviewText, GROUP_FIT_KEYWORDS.spacious)) tags.add("大人数向き");
  if (containsAny(reviewText, GROUP_FIT_KEYWORDS.quiet)) tags.add("静か");
  if (containsAny(reviewText, GROUP_FIT_KEYWORDS.noisy)) tags.add("賑やか");
  if (containsAny(reviewText, GROUP_FIT_KEYWORDS.smallGroup)) tags.add("要・大人数確認");

  if (tags.size === 0 && Array.isArray(place?.photos) && place.photos.length > 0) {
    tags.add("写真あり");
  }

  return {
    provider: "metadata-keyword-heuristics",
    group_fit_tags: Array.from(tags),
  };
}

export function priceBandTags(priceLevel) {
  if (priceLevel === "PRICE_LEVEL_INEXPENSIVE") return ["価格読みやすい"];
  if (priceLevel === "PRICE_LEVEL_EXPENSIVE" || priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE") return ["予算高め"];
  return [];
}

export const GROUP_FIT_VLM_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["group_fit_tags", "rationale"],
  properties: {
    group_fit_tags: {
      type: "array",
      maxItems: 6,
      items: {
        type: "string",
        enum: ["個室あり気配", "大人数向き", "静か", "賑やか", "予算高め", "価格読みやすい", "要・大人数確認"],
      },
    },
    rationale: { type: "string" },
  },
});

export function buildGroupFitVlmPrompt({ placeName, metadata, reviews }) {
  return [
    "You assess whether a restaurant appears usable for a group meal.",
    "Do not score taste, deliciousness, cuisine quality, or personal preference.",
    "Use only visible/photo metadata and operational text signals: space, seats, private-room likelihood, noise, price fit.",
    `Place: ${placeName ?? "unknown"}`,
    `Metadata: ${JSON.stringify(metadata ?? {}, null, 2)}`,
    `Review snippets: ${JSON.stringify(normalizeReviews(reviews).map((review) => review.text), null, 2)}`,
    "Return strict JSON matching this schema:",
    JSON.stringify(GROUP_FIT_VLM_JSON_SCHEMA, null, 2),
  ].join("\n");
}

export async function scoreGroupFitWithVlm(input, env = process.env) {
  if (env.QUALITY_VLM_APPROVED !== "1") {
    throw new Error("VLM group-fit scoring is blocked until QUALITY_VLM_APPROVED=1. No SDK wiring exists in R6b.");
  }
  void buildGroupFitVlmPrompt(input);
  throw new Error("VLM group-fit adapter stub only: model selection and SDK wiring are founder-pending.");
}

export function scorePlaceQuality(place, options = {}) {
  const computedAt = options.computedAt ?? new Date().toISOString();
  const evidenceThreshold = Math.max(0, options.evidenceThreshold ?? DEFAULT_EVIDENCE_THRESHOLD);
  const placeId = place?.id ?? place?.place_id ?? place?.placeId;
  const name = place?.displayName?.text ?? place?.name ?? placeId ?? "unknown";
  const reviewCount = place?.userRatingCount ?? place?.reviewCount ?? null;
  const bayesian = computeBayesianAverage(
    { rating: place?.rating ?? null, reviewCount },
    options.prior ?? DEFAULT_BAYESIAN_PRIOR
  );
  const evidence = computeEvidence({ rating: place?.rating ?? null, reviewCount }, options.prior ?? DEFAULT_BAYESIAN_PRIOR);
  const stage = evidence.raw >= evidenceThreshold ? 1 : 2;
  const reviewTriage = stage === 1 ? { provider: "stage-1-skip", negatives: [] } : options.reviewTriage ?? triageReviewsWithKeywords(place);
  const groupFit =
    stage === 1
      ? { provider: "stage-1-price-only", group_fit_tags: priceBandTags(place?.priceLevel) }
      : options.groupFit ?? scoreGroupFitWithHeuristics(place);

  const negativePenalty = Math.min(
    0.5,
    reviewTriage.negatives.reduce((sum, negative) => sum + negative.weight, 0)
  );
  const sparsePenalty =
    stage === 1 ? 0 : bayesian.usedInput && bayesian.inputReviewCount < 20 ? 0.08 : bayesian.usedInput ? 0 : 0.12;
  const pricePenalty =
    stage === 1 && (place?.priceLevel === "PRICE_LEVEL_EXPENSIVE" || place?.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE")
      ? 0.02
      : 0;
  const ratingRisk = clamp((4.55 - bayesian.average) / 1.4, 0.05, 0.9);
  const hazureRisk = clamp(ratingRisk * 0.7 + negativePenalty + sparsePenalty + pricePenalty, 0, 1);

  return {
    place_id: placeId,
    external_id: place?.external_id ?? (placeId ? `place:${placeId}` : null),
    name,
    stage,
    evidence: {
      rating: evidence.rating,
      count: evidence.count,
      bayes: evidence.bayes,
    },
    evidence_threshold: evidenceThreshold,
    hazure_risk: round3(hazureRisk),
    group_fit_tags: groupFit.group_fit_tags,
    negatives: reviewTriage.negatives.map((negative) => ({
      category: negative.category,
      label: negative.label,
      severity: negative.severity,
      weight: negative.weight,
      evidence: negative.evidence,
      review_index: negative.review_index,
    })),
    computed_at: computedAt,
    engine_version: ENGINE_VERSION,
  };
}

export function scoreCatalog(places, options = {}) {
  if (!Array.isArray(places)) {
    throw new Error("scoreCatalog expected an array of place details.");
  }
  return places.map((place) => scorePlaceQuality(place, options));
}
