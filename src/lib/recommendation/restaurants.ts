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

/**
 * Lower-weighted average: lower budgets get more weight.
 * Sorted descending, rank i gets weight (i+1) / totalRank.
 */
function getLowerWeightedBudget(budgets: number[]): number {
  const sorted = [...budgets].sort((a, b) => b - a);
  const n = sorted.length;
  const totalRank = (n * (n + 1)) / 2;
  return sorted.reduce((sum, b, i) => {
    const weight = (i + 1) / totalRank;
    return sum + b * weight;
  }, 0);
}

export function aggregateBudgetSignals(
  signals: BudgetSignal[]
): AggregatedBudgetPreference {
  const ceilings = signals
    .map((s) => s.ceiling)
    .filter((v): v is number => typeof v === "number" && v > 0);

  if (ceilings.length === 0) {
    return {
      respondentCount: 0,
      weightedBudget: null,
      medianTier: null,
      toleranceLower: null,
      toleranceUpper: null,
      minCeiling: null,
      hasVariance: false,
    };
  }

  const weightedBudget = Math.round(getLowerWeightedBudget(ceilings));
  const minCeiling = Math.min(...ceilings);
  const tierIdx = nearestTierIndex(weightedBudget);
  const lo = BUDGET_TIERS[Math.max(0, tierIdx - 1)];
  const hi = BUDGET_TIERS[Math.min(BUDGET_TIERS.length - 1, tierIdx + 1)];

  return {
    respondentCount: ceilings.length,
    weightedBudget,
    medianTier: BUDGET_TIERS[tierIdx],
    toleranceLower: lo,
    toleranceUpper: hi,
    minCeiling,
    hasVariance: weightedBudget - minCeiling >= 2000,
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

/**
 * Continuous distance-based budget scoring.
 * Within tolerance band = 1.0, then linear decay: 1000 yen away = 0.0
 */
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

  const lo = aggregate.toleranceLower ?? aggregate.medianTier;
  const hi = aggregate.toleranceUpper ?? aggregate.medianTier;

  // Within tolerance band = perfect fit
  if (restMid >= lo && restMid <= hi) {
    reasons.push("budget_overlap");
    return {
      score: 1.0,
      reasons,
      tags: restaurantReasonTags(reasons),
      explanation: buildRestaurantExplanation(reasons),
    };
  }

  // Outside band: linear decay, 1000 yen distance = score 0
  const dist = restMid < lo ? lo - restMid : restMid - hi;
  const score = Math.max(0, 1 - dist / 1000);

  if (score >= 0.5) {
    reasons.push("budget_safe");
  }

  return {
    score,
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
    baseMatch * 0.35 +
      budgetFit.score * 0.30 +
      focusScore * 0.15 +
      atmosphereScore * 0.10 +
      groupSizeScore * 0.10
  );

  return {
    matchScore: finalScore,
    rating: Number((3 + finalScore * 2).toFixed(1)),
    reasons,
    reasonTags: restaurantReasonTags(reasons),
    reasonExplanation: buildRestaurantExplanation(reasons),
  };
}
