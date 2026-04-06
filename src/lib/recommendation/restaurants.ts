import type {
  Restaurant,
  SessionAtmosphere,
  SessionFocus,
} from "@/lib/types";
import { buildRestaurantExplanation, restaurantReasonTags } from "@/lib/recommendation/reasons";
import type {
  AggregatedBudgetPreference,
  BudgetSignal,
  RestaurantBudgetRange,
  RestaurantReasonCode,
} from "@/lib/recommendation/types";

export const BUDGET_TIERS = [1000, 2000, 3000, 5000, 8000] as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function isDrinkFriendly(restaurant: Restaurant) {
  return /(居酒屋|バー|バル|焼肉|韓国|ダイニング)/.test(restaurant.genre);
}

function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function nearestTierIndex(value: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < BUDGET_TIERS.length; i++) {
    const dist = Math.abs(BUDGET_TIERS[i] - value);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function aggregateBudgetSignals(
  signals: BudgetSignal[]
): AggregatedBudgetPreference {
  const tierValues = signals
    .map((s) => s.tier)
    .filter((v): v is number => typeof v === "number" && v > 0);

  if (tierValues.length === 0) {
    return { respondentCount: 0, medianTier: null, toleranceLower: null, toleranceUpper: null };
  }

  const median = getMedian(tierValues);
  const tierIdx = nearestTierIndex(median);
  const lo = BUDGET_TIERS[Math.max(0, tierIdx - 1)];
  const hi = BUDGET_TIERS[Math.min(BUDGET_TIERS.length - 1, tierIdx + 1)];

  return {
    respondentCount: tierValues.length,
    medianTier: BUDGET_TIERS[tierIdx],
    toleranceLower: lo,
    toleranceUpper: hi,
  };
}

export function parseBudgetText(text: string | null | undefined): RestaurantBudgetRange {
  if (!text) {
    return { minYen: null, maxYen: null };
  }

  const numbers = Array.from(text.matchAll(/\d[\d,]*/g)).map((match) =>
    Number(match[0].replace(/,/g, ""))
  );

  if (numbers.length === 0) {
    return { minYen: null, maxYen: null };
  }

  if (numbers.length === 1) {
    return { minYen: numbers[0], maxYen: numbers[0] };
  }

  return {
    minYen: Math.min(...numbers),
    maxYen: Math.max(...numbers),
  };
}

export function scoreBudgetFit(
  restaurantBudget: RestaurantBudgetRange,
  aggregate: AggregatedBudgetPreference
) {
  const reasons: RestaurantReasonCode[] = [];

  if (aggregate.respondentCount === 0 || aggregate.medianTier === null) {
    return {
      score: 0.5,
      reasons,
      tags: restaurantReasonTags(reasons),
      explanation: buildRestaurantExplanation(reasons),
    };
  }

  if (restaurantBudget.minYen === null && restaurantBudget.maxYen === null) {
    return {
      score: 0.5,
      reasons,
      tags: restaurantReasonTags(reasons),
      explanation: buildRestaurantExplanation(reasons),
    };
  }

  const restMid =
    restaurantBudget.minYen !== null && restaurantBudget.maxYen !== null
      ? (restaurantBudget.minYen + restaurantBudget.maxYen) / 2
      : (restaurantBudget.minYen ?? restaurantBudget.maxYen)!;

  const ideal = aggregate.medianTier;
  const lo = aggregate.toleranceLower ?? ideal;
  const hi = aggregate.toleranceUpper ?? ideal;

  if (restMid >= ideal * 0.8 && restMid <= ideal * 1.2) {
    reasons.push("budget_overlap");
    return {
      score: 1.0,
      reasons,
      tags: restaurantReasonTags(reasons),
      explanation: buildRestaurantExplanation(reasons),
    };
  }

  if (restMid >= lo && restMid <= hi) {
    reasons.push("budget_safe");
    return {
      score: 0.5,
      reasons,
      tags: restaurantReasonTags(reasons),
      explanation: buildRestaurantExplanation(reasons),
    };
  }

  return {
    score: 0.0,
    reasons,
    tags: restaurantReasonTags(reasons),
    explanation: buildRestaurantExplanation(reasons),
  };
}

export function scoreRestaurantForSession(params: {
  restaurant: Restaurant;
  baseMatch: number;
  groupSize: number;
  sessionAtmosphere: SessionAtmosphere | null;
  sessionFocus: SessionFocus | null;
  budgetSignals: AggregatedBudgetPreference;
}) {
  const {
    restaurant,
    baseMatch,
    groupSize,
    sessionAtmosphere,
    sessionFocus,
    budgetSignals,
  } = params;
  const budgetFit = scoreBudgetFit(parseBudgetText(restaurant.budget), budgetSignals);
  const reasons: RestaurantReasonCode[] = [...budgetFit.reasons];
  let focusScore = 0.55;
  let atmosphereScore = 0.55;
  let groupSizeScore = groupSize >= 5 ? 0.45 : 0.6;

  if (baseMatch >= 0.72) {
    reasons.push("preferred_genre_match");
  }

  if (sessionFocus === "drink_centered") {
    focusScore = isDrinkFriendly(restaurant) ? 0.88 : 0.35;
    if (isDrinkFriendly(restaurant)) reasons.push("drink_focus_fit");
  } else if (sessionFocus === "food_centered") {
    focusScore = isDrinkFriendly(restaurant) ? 0.4 : 0.82;
    if (!isDrinkFriendly(restaurant)) reasons.push("food_focus_fit");
  }

  if (sessionAtmosphere === "polished" || sessionAtmosphere === "calm") {
    atmosphereScore = restaurant.hasPrivateRoom ? 0.85 : 0.45;
    if (restaurant.hasPrivateRoom) reasons.push("atmosphere_fit");
  } else if (sessionAtmosphere === "lively") {
    atmosphereScore = isDrinkFriendly(restaurant) ? 0.84 : 0.5;
    if (isDrinkFriendly(restaurant)) reasons.push("atmosphere_fit");
  }

  if (groupSize >= 5 && restaurant.hasPrivateRoom) {
    groupSizeScore = 0.85;
    reasons.push("group_size_fit");
  }

  const finalScore = clamp(
    baseMatch * 0.5 +
      budgetFit.score * 0.2 +
      focusScore * 0.1 +
      atmosphereScore * 0.1 +
      groupSizeScore * 0.1
  );

  return {
    matchScore: finalScore,
    rating: Number((3 + finalScore * 2).toFixed(1)),
    reasons,
    reasonTags: restaurantReasonTags(reasons),
    reasonExplanation: buildRestaurantExplanation(reasons),
  };
}
