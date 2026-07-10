import { resolveZoneForStation } from "@/lib/areas";
import { DIETARY_PRESETS } from "@/lib/dietary-presets";
import type { PooledRestaurant } from "@/lib/restaurants/pool";
import type {
  GroupMode,
  Restaurant,
  SessionAtmosphere,
  SessionFocus,
  SurveyResponse,
} from "@/lib/types";
import type { GenreScore } from "@/lib/types";
import {
  aggregateBudgetSignals,
  parseBudgetText,
  scoreBudgetFit,
  scoreRestaurantForSession,
} from "@/lib/recommendation/restaurants";
import type { AggregatedBudgetPreference } from "@/lib/recommendation/types";

export const RANKING_PRESETS = {
  planned: {
    wRec: 0.52,
    wPref: 0.32,
    wAccess: 0.16,
    openNowHardFilter: false,
  },
  instant: {
    wRec: 0.45,
    wPref: 0.2,
    wAccess: 0.35,
    openNowHardFilter: true,
  },
} as const;

export type RankingPresetName = keyof typeof RANKING_PRESETS;

const PR_SCORE_PENALTY = 0.18;

// Static first-generation zone adjacency, derived from rough central Tokyo geography
// and direct-neighbor hub relationships. Same zone = 0, adjacent = 1, otherwise = 2.
export const ZONE_ADJACENCY: Record<string, string[]> = {
  shibuya: ["ebisu", "omotesando", "shimokitazawa", "shinjuku", "roppongi", "meguro"],
  shinjuku: ["shibuya", "ikebukuro", "shimokitazawa", "omotesando", "kichijoji"],
  ikebukuro: ["shinjuku", "ueno"],
  tokyo: ["ginza", "akihabara", "ueno", "shinagawa"],
  shinagawa: ["tokyo", "ginza", "meguro", "yokohama"],
  ueno: ["akihabara", "asakusa", "tokyo", "ikebukuro"],
  ginza: ["tokyo", "roppongi", "shinagawa", "akihabara"],
  roppongi: ["shibuya", "ebisu", "omotesando", "ginza"],
  ebisu: ["shibuya", "roppongi", "meguro", "omotesando"],
  meguro: ["ebisu", "shibuya", "shinagawa"],
  akihabara: ["tokyo", "ueno", "ginza", "asakusa"],
  asakusa: ["ueno", "akihabara"],
  omotesando: ["shibuya", "roppongi", "ebisu", "shinjuku"],
  shimokitazawa: ["shibuya", "shinjuku", "kichijoji"],
  kichijoji: ["shimokitazawa", "shinjuku", "tachikawa"],
  tachikawa: ["kichijoji", "machida"],
  machida: ["tachikawa", "yokohama"],
  yokohama: ["shinagawa", "machida"],
};

export interface RankedRestaurant extends Restaurant {
  rankingScore: number;
  isMemberFavorite: boolean;
  endorsementLabel: string | null;
  publicFavoriteCount: number;
  recommendedByNames: string[];
  officialRecommendedByNames: string[];
  recommendationLabel: string | null;
  recommendedAt: string | null;
  pr: boolean;
  ring: 0 | 1 | 2;
}

type OpeningState = "open" | "closed" | "unknown";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function presetNameForMode(mode: GroupMode | null | undefined): RankingPresetName {
  return mode === "instant" ? "instant" : "planned";
}

export function getRankingPreset(mode: GroupMode | null | undefined) {
  return RANKING_PRESETS[presetNameForMode(mode)];
}

function zoneDistance(fromZoneId: string, toZoneId: string) {
  if (fromZoneId === toZoneId) return 0;
  return ZONE_ADJACENCY[fromZoneId]?.includes(toZoneId) ? 1 : 2;
}

export function accessPenaltyForRestaurant(
  restaurant: Pick<Restaurant, "area">,
  memberStations: (string | null | undefined)[]
) {
  const restaurantZone = resolveZoneForStation(restaurant.area);
  if (!restaurantZone) return null;

  const distances = memberStations
    .map((station) => resolveZoneForStation(station))
    .filter((zone): zone is NonNullable<ReturnType<typeof resolveZoneForStation>> =>
      Boolean(zone)
    )
    .map((zone) => zoneDistance(zone.id, restaurantZone.id));

  if (distances.length === 0) return null;
  return Math.max(...distances);
}

function preferenceScore(params: {
  restaurant: Restaurant;
  groupGenreScores: Record<string, GenreScore>;
  groupSize: number;
  sessionAtmosphere: SessionAtmosphere | null;
  sessionFocus: SessionFocus | null;
  budgetSignals: AggregatedBudgetPreference;
}) {
  const genreScore =
    params.groupGenreScores[params.restaurant.genreId]?.normalizedScore ?? 0.5;
  return scoreRestaurantForSession({
    restaurant: params.restaurant,
    baseMatch: genreScore,
    groupSize: params.groupSize,
    sessionAtmosphere: params.sessionAtmosphere,
    sessionFocus: params.sessionFocus,
    budgetSignals: params.budgetSignals,
  });
}

export function isClearBudgetCeilingViolation(
  restaurant: Pick<Restaurant, "budget">,
  budgetSignals: AggregatedBudgetPreference
) {
  if (budgetSignals.maxAcceptableYen === null) return false;
  const budget = parseBudgetText(restaurant.budget);
  if (budget.minYen === null) return false;
  return budget.minYen > budgetSignals.maxAcceptableYen;
}

function hasDietaryConflict(restaurant: Restaurant, surveys: SurveyResponse[]) {
  const mustRestrictions = surveys.flatMap((survey) =>
    (survey.dietaryRestrictions ?? [])
      .filter((restriction) => restriction.priority === "must")
      .map((restriction) => restriction.restrictionId)
  );
  if (mustRestrictions.length === 0) return false;

  return mustRestrictions.some((restrictionId) => {
    const preset = DIETARY_PRESETS.find((item) => item.id === restrictionId);
    if (!preset) return false;
    return (preset.genreScores[restaurant.genreId] ?? 0) <= -0.75;
  });
}

export function openingStateForRestaurant(
  restaurant: Pick<Restaurant, "openingHours">
): OpeningState {
  const openingHours = restaurant.openingHours;
  if (!openingHours) return "unknown";

  const direct =
    (openingHours.openNow as unknown) ??
    (openingHours.open_now as unknown) ??
    (openingHours.isOpenNow as unknown);
  if (typeof direct === "boolean") return direct ? "open" : "closed";

  if (openingHours.knownClosedNow === true || openingHours.closedNow === true) {
    return "closed";
  }

  return "unknown";
}

function accessTags(accessPenalty: number | null) {
  if (accessPenalty === null) return [];
  if (accessPenalty === 0) return ["全員30分圏内"];
  if (accessPenalty === 1) return ["全員ひと駅圏内"];
  return ["少し遠め"];
}

function openingTags(openingState: OpeningState) {
  if (openingState === "open") return ["いま営業中"];
  if (openingState === "unknown") return ["営業時間 要確認"];
  return [];
}

function recommendationTags(entry: PooledRestaurant) {
  const tags: string[] = [];
  if (entry.pr) tags.push("PR");
  if (entry.contributorLabels[0]) tags.push(entry.contributorLabels[0]);
  if (entry.sourceCount >= 2) tags.push("複数人推し");
  if (entry.ring === 2 && entry.officialRecommendedByNames[0]) {
    tags.push(`${entry.officialRecommendedByNames[0]}公式のおすすめ`);
  }
  return tags;
}

function recommendationLabel(entry: PooledRestaurant) {
  return (
    entry.contributorLabels[0] ??
    entry.endorsementLabel ??
    (entry.recommendedByNames[0]
      ? `${entry.recommendedByNames[0]}さんのお気に入り`
      : entry.officialRecommendedByNames[0]
        ? `${entry.officialRecommendedByNames[0]}公式のおすすめ`
        : null)
  );
}

export function rankCandidatePool(params: {
  pooled: PooledRestaurant[];
  mode?: GroupMode | null;
  surveys: SurveyResponse[];
  groupGenreScores: Record<string, GenreScore>;
  budgetSignals?: AggregatedBudgetPreference;
  groupSize: number;
  sessionAtmosphere: SessionAtmosphere | null;
  sessionFocus: SessionFocus | null;
  now?: Date;
}) {
  const {
    pooled,
    mode,
    surveys,
    groupGenreScores,
    groupSize,
    sessionAtmosphere,
    sessionFocus,
  } = params;
  const preset = getRankingPreset(mode);
  const budgetSignals =
    params.budgetSignals ??
    aggregateBudgetSignals(
      surveys.map((survey) => ({
        idealYen: survey.budgetIdealYen ?? null,
        maxYen: survey.budgetMaxYen ?? null,
        priority: survey.budgetPriority ?? null,
      }))
    );
  const memberStations = surveys.map((survey) => survey.departureStation ?? null);

  return pooled
    .map((entry): RankedRestaurant | null => {
      const restaurant = entry.restaurant;
      const openingState = openingStateForRestaurant(restaurant);
      if (preset.openNowHardFilter && openingState === "closed") return null;
      if (isClearBudgetCeilingViolation(restaurant, budgetSignals)) return null;
      if (hasDietaryConflict(restaurant, surveys)) return null;

      const sessionScore = preferenceScore({
        restaurant,
        groupGenreScores,
        groupSize,
        sessionAtmosphere,
        sessionFocus,
        budgetSignals,
      });
      const accessPenalty = accessPenaltyForRestaurant(restaurant, memberStations);
      const normalizedAccessPenalty = accessPenalty === null ? 0 : accessPenalty / 2;
      const budgetFit = scoreBudgetFit(parseBudgetText(restaurant.budget), budgetSignals);
      const reasonTags = [
        ...recommendationTags(entry),
        ...accessTags(accessPenalty),
        ...budgetFit.tags,
        ...openingTags(openingState),
        ...sessionScore.reasonTags.filter((tag) => !budgetFit.tags.includes(tag)),
      ];
      const rankingScore = clamp(
        preset.wRec * entry.recommendationStrength +
          preset.wPref * sessionScore.matchScore -
          preset.wAccess * normalizedAccessPenalty -
          (entry.pr ? PR_SCORE_PENALTY : 0),
        -1,
        2
      );

      const ranked: RankedRestaurant = {
        ...restaurant,
        matchScore: rankingScore,
        rankingScore,
        rating: sessionScore.rating,
        reasonTags: [...new Set(reasonTags)],
        reasonExplanation: sessionScore.reasonExplanation,
        genreScore: groupGenreScores[restaurant.genreId]?.score ?? 0,
        isMemberFavorite: entry.isMemberFavorite,
        endorsementLabel: entry.endorsementLabel,
        publicFavoriteCount: entry.publicFavoriteCount,
        recommendedByNames: entry.recommendedByNames,
        officialRecommendedByNames: entry.officialRecommendedByNames,
        recommendationLabel: recommendationLabel(entry),
        recommendedAt: entry.latestSourceAt,
        pr: entry.pr,
        ring: entry.ring,
      };
      return ranked;
    })
    .filter((restaurant): restaurant is RankedRestaurant => restaurant !== null)
    .sort((a, b) => b.rankingScore - a.rankingScore);
}

export function stripInternalScore<T extends { matchScore?: number; rankingScore?: number }>(
  restaurant: T
) {
  const publicRestaurant = { ...restaurant };
  delete publicRestaurant.matchScore;
  delete publicRestaurant.rankingScore;
  return publicRestaurant;
}
