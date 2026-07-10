import type {
  PriorityLevel,
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

function priorityRank(priority: PriorityLevel | null | undefined) {
  if (priority === "must") return 3;
  if (priority === "prefer") return 2;
  if (priority === "optional") return 1;
  return 0;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function isDrinkFriendly(restaurant: Restaurant) {
  return /(居酒屋|バー|バル|焼肉|韓国|ダイニング)/.test(restaurant.genre);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function aggregateBudgetSignals(
  signals: BudgetSignal[]
): AggregatedBudgetPreference {
  const activeSignals = signals.filter(
    (signal) => signal.idealYen || signal.maxYen || signal.priority
  );
  const idealValues = activeSignals
    .map((signal) => signal.idealYen)
    .filter((value): value is number => typeof value === "number");
  const maxValues = activeSignals
    .map((signal) => signal.maxYen)
    .filter((value): value is number => typeof value === "number");
  const strongestPriority = activeSignals
    .map((signal) => signal.priority ?? null)
    .sort((a, b) => priorityRank(b) - priorityRank(a))[0] ?? null;

  const idealMedian = median(idealValues);
  const maxMedian = median(maxValues);

  return {
    respondentCount: activeSignals.length,
    idealLowerYen: idealMedian ? Math.round(idealMedian * 0.85) : null,
    idealUpperYen: idealMedian ? Math.round(idealMedian * 1.15) : null,
    maxAcceptableYen: maxMedian,
    strongestPriority,
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

  if (aggregate.respondentCount === 0 || restaurantBudget.maxYen === null) {
    return {
      score: 0.55,
      reasons,
      tags: restaurantReasonTags(reasons),
      explanation: buildRestaurantExplanation(reasons),
    };
  }

  const withinIdeal =
    aggregate.idealLowerYen !== null &&
    aggregate.idealUpperYen !== null &&
    restaurantBudget.minYen !== null &&
    restaurantBudget.maxYen >= aggregate.idealLowerYen &&
    restaurantBudget.minYen <= aggregate.idealUpperYen;

  const withinMax =
    aggregate.maxAcceptableYen !== null &&
    restaurantBudget.minYen !== null &&
    restaurantBudget.minYen <= aggregate.maxAcceptableYen;

  let score = 0.35;

  if (withinIdeal) {
    score += 0.4;
    reasons.push("budget_overlap");
  }

  if (withinMax) {
    score += 0.2;
    reasons.push("budget_safe");
  }

  if (
    aggregate.strongestPriority === "must" &&
    aggregate.maxAcceptableYen !== null &&
    restaurantBudget.minYen !== null &&
    restaurantBudget.minYen > aggregate.maxAcceptableYen
  ) {
    score = 0.05;
  }

  return {
    score: Math.min(1, score),
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
    reasonExplanation: buildRestaurantExplanation(reasons, {
      genreName: restaurant.genre || null,
      area: restaurant.area || null,
    }),
  };
}
