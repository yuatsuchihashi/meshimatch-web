import { MOODS } from "@/lib/moods";
import {
  INSTANT_OPINIONS,
  INSTANT_OPINION_TOKENS,
} from "@/lib/instant/opinions";
import { GENRES } from "@/lib/restaurant-taxonomy";
import type {
  DietaryRestrictionInput,
  GenrePreferenceInput,
  Restaurant,
} from "@/lib/types";

const GENRE_IDS = new Set<string>(GENRES.map((genre) => genre.code));
const MOOD_IDS = new Set<string>(MOODS.map((mood) => mood.id));
const OPINION_IDS = new Set<string>(INSTANT_OPINION_TOKENS);
const OPINION_BY_ID = new Map(
  INSTANT_OPINIONS.map((opinion) => [opinion.id as string, opinion])
);

export type RoomTokenCount = {
  token: string;
  count: number;
};

export type RoomSurveyInput = {
  wish?: unknown;
  avoid?: unknown;
  genrePreferences?: unknown;
  preferMoods?: unknown;
  avoidMoods?: unknown;
  dietaryRestrictions?: unknown;
};

export type NormalizedRoomSurvey = {
  genrePreferences: GenrePreferenceInput[];
  preferMoods: string[];
  avoidMoods: string[];
  dietaryRestrictions: DietaryRestrictionInput[];
};

export type RoomProposalState = {
  revision: 0 | 1;
  proposedAt: string;
  restaurant: RoomRestaurant;
};

export type RoomZone = {
  zoneId: string;
  name: string;
  station: string;
  source: "gps" | "manual";
};

export type RoomState = {
  kind: "instant_room_state";
  zone: RoomZone | null;
  proposal: RoomProposalState | null;
};

export type RoomRestaurant = Pick<
  Restaurant,
  | "id"
  | "name"
  | "genreId"
  | "area"
  | "budget"
  | "address"
  | "photoUrl"
  | "placeId"
  | "googleRating"
  | "reasonTags"
  | "reasonExplanation"
>;

type SurveyAggregateRow = {
  genre_preferences?: unknown;
  prefer_moods?: unknown;
  avoid_moods?: unknown;
};

export type InstantCatalogPreferenceRow = {
  genre_preferences?: unknown;
};

function stringArray(value: unknown): string[] {
  const values = typeof value === "string" ? [value] : value;
  if (!Array.isArray(values)) return [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validMoodIds(value: unknown): string[] {
  return [
    ...new Set(
      stringArray(value).filter(
        (item) =>
          MOOD_IDS.has(item) ||
          (item.startsWith("instant:") &&
            OPINION_IDS.has(item.slice("instant:".length)))
      )
    ),
  ];
}

function tokenIds(value: unknown) {
  const values = stringArray(value);
  return {
    genres: [
      ...new Set([
        ...values.filter((item) => GENRE_IDS.has(item)),
        ...values.flatMap((item) => OPINION_BY_ID.get(item)?.genreIds ?? []),
      ]),
    ],
    moods: values.flatMap((item) => {
      if (OPINION_IDS.has(item)) return [`instant:${item}`];
      if (MOOD_IDS.has(item)) return [item];
      if (
        item.startsWith("instant:") &&
        OPINION_IDS.has(item.slice("instant:".length))
      ) {
        return [item];
      }
      return [];
    }),
  };
}

function genrePreferences(
  value: unknown
): { genreId: string; priority: "prefer" | "avoid" }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item == null || typeof item !== "object") return [];
    const row = item as { genreId?: unknown; priority?: unknown };
    if (
      typeof row.genreId !== "string" ||
      !GENRE_IDS.has(row.genreId) ||
      (row.priority !== "prefer" && row.priority !== "avoid")
    ) {
      return [];
    }
    return [{ genreId: row.genreId, priority: row.priority }];
  });
}

function dietaryRestrictions(value: unknown): DietaryRestrictionInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item == null || typeof item !== "object") return [];
    const row = item as { restrictionId?: unknown; priority?: unknown };
    if (
      typeof row.restrictionId !== "string" ||
      row.restrictionId.trim() === "" ||
      !["must", "prefer", "optional", "avoid"].includes(
        String(row.priority)
      )
    ) {
      return [];
    }
    return [
      {
        restrictionId: row.restrictionId.trim(),
        priority: row.priority as DietaryRestrictionInput["priority"],
      },
    ];
  });
}

export function normalizeRoomSurvey(
  input: RoomSurveyInput
): NormalizedRoomSurvey {
  const wish = tokenIds(input.wish);
  const avoid = tokenIds(input.avoid);
  const priorities = new Map<string, "prefer" | "avoid">();

  for (const preference of genrePreferences(input.genrePreferences)) {
    priorities.set(preference.genreId, preference.priority);
  }
  for (const genreId of wish.genres) priorities.set(genreId, "prefer");
  // A stated objection wins if the same token appears on both sides.
  for (const genreId of avoid.genres) priorities.set(genreId, "avoid");

  const preferMoods = new Set([
    ...validMoodIds(input.preferMoods),
    ...wish.moods,
  ]);
  const avoidMoods = new Set([
    ...validMoodIds(input.avoidMoods),
    ...avoid.moods,
  ]);
  for (const mood of avoidMoods) preferMoods.delete(mood);

  return {
    genrePreferences: [...priorities.entries()].map(
      ([genreId, priority]) => ({ genreId, priority })
    ),
    preferMoods: [...preferMoods],
    avoidMoods: [...avoidMoods],
    dietaryRestrictions: dietaryRestrictions(input.dietaryRestrictions),
  };
}

function increment(counts: Map<string, number>, token: string) {
  const displayToken = token.startsWith("instant:")
    ? token.slice("instant:".length)
    : token;
  counts.set(displayToken, (counts.get(displayToken) ?? 0) + 1);
}

function sortedCounts(counts: Map<string, number>): RoomTokenCount[] {
  return [...counts.entries()]
    .map(([token, count]) => ({ token, count }))
    .sort((left, right) => right.count - left.count || left.token.localeCompare(right.token));
}

export function aggregateRoomTokens(
  rows: readonly SurveyAggregateRow[],
  groupSize: number = rows.length
) {
  if (groupSize < 5) return { wish: [], avoid: [] };
  const wish = new Map<string, number>();
  const avoid = new Map<string, number>();

  for (const row of rows) {
    const preferMoods = validMoodIds(row.prefer_moods);
    const avoidMoods = validMoodIds(row.avoid_moods);
    const hasOpinionWish = preferMoods.some((mood) =>
      mood.startsWith("instant:")
    );
    const hasOpinionAvoid = avoidMoods.some((mood) =>
      mood.startsWith("instant:")
    );
    for (const preference of genrePreferences(row.genre_preferences)) {
      if (preference.priority === "prefer" && hasOpinionWish) continue;
      if (preference.priority === "avoid" && hasOpinionAvoid) continue;
      increment(
        preference.priority === "avoid" ? avoid : wish,
        preference.genreId
      );
    }
    for (const mood of preferMoods) increment(wish, mood);
    for (const mood of avoidMoods) increment(avoid, mood);
  }

  return {
    wish: sortedCounts(wish).filter((item) => item.count >= 2),
    avoid: sortedCounts(avoid).filter((item) => item.count >= 2),
  };
}

export function safeRoomZone(value: unknown): RoomZone | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Partial<RoomZone>;
  if (
    typeof row.zoneId !== "string" ||
    typeof row.name !== "string" ||
    typeof row.station !== "string"
  ) {
    return null;
  }
  return {
    zoneId: row.zoneId,
    name: row.name,
    station: row.station,
    source: row.source === "manual" ? "manual" : "gps",
  };
}

function parseProposal(value: unknown): RoomProposalState | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Partial<RoomProposalState>;
  const restaurant = row.restaurant as Partial<RoomRestaurant> | undefined;
  if (
    (row.revision !== 0 && row.revision !== 1) ||
    typeof row.proposedAt !== "string" ||
    !restaurant ||
    typeof restaurant.id !== "string" ||
    typeof restaurant.name !== "string"
  ) {
    return null;
  }
  return row as RoomProposalState;
}

export function roomStateFromShortlist(value: unknown): RoomState {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Partial<RoomState>;
    if (row.kind === "instant_room_state") {
      return {
        kind: "instant_room_state",
        zone: safeRoomZone(row.zone),
        proposal: parseProposal(row.proposal),
      };
    }
    // Backward compatibility for the first room-proposal draft.
    const proposal = parseProposal(value);
    if (proposal) {
      return { kind: "instant_room_state", zone: null, proposal };
    }
  }
  return { kind: "instant_room_state", zone: null, proposal: null };
}

export function roomProposalFromShortlist(
  value: unknown
): RoomProposalState | null {
  return roomStateFromShortlist(value).proposal;
}

export function roomRestaurantFromRanked(
  restaurant: Restaurant
): RoomRestaurant {
  return {
    id: restaurant.id,
    name: restaurant.name,
    genreId: restaurant.genreId,
    area: restaurant.area,
    budget: restaurant.budget,
    address: restaurant.address,
    photoUrl: restaurant.photoUrl,
    placeId: restaurant.placeId,
    googleRating: restaurant.googleRating,
    reasonTags: restaurant.reasonTags,
    reasonExplanation: restaurant.reasonExplanation,
  };
}

/**
 * Guests do not have social trust-ring edges yet. With a GPS-derived area,
 * rank the existing restaurant catalog as an explicit instant-only fallback.
 * The caller is responsible for passing only open, same-area rows.
 */
export function rankInstantCatalogFallback(
  restaurants: readonly Restaurant[],
  surveys: readonly InstantCatalogPreferenceRow[],
  limit = 2
): Restaurant[] {
  const genreScores = new Map<string, number>();
  for (const survey of surveys) {
    for (const preference of genrePreferences(survey.genre_preferences)) {
      const weight = preference.priority === "prefer" ? 2 : -4;
      genreScores.set(
        preference.genreId,
        (genreScores.get(preference.genreId) ?? 0) + weight
      );
    }
  }

  return restaurants
    .filter(
      (restaurant) =>
        Boolean(restaurant.id && restaurant.name && restaurant.address) &&
        restaurant.name.length <= 80 &&
        /\p{L}/u.test(restaurant.name)
    )
    .map((restaurant) => ({
      restaurant,
      preferenceScore: genreScores.get(restaurant.genreId) ?? 0,
      rating: restaurant.googleRating ?? restaurant.rating ?? 0,
    }))
    .sort(
      (left, right) =>
        right.preferenceScore - left.preferenceScore ||
        right.rating - left.rating ||
        left.restaurant.name.localeCompare(right.restaurant.name, "ja")
    )
    .slice(0, Math.max(0, limit))
    .map(({ restaurant, preferenceScore }) => ({
      ...restaurant,
      reasonTags: [
        ...(preferenceScore > 0 ? ["みんなのWish"] : []),
        restaurant.area ? `${restaurant.area}の近く` : "近くの候補",
        "レストラン台帳",
      ],
      reasonExplanation:
        preferenceScore > 0
          ? "みんなのWishと、今いるエリアを優先した候補です。"
          : "今いるエリアのレストラン台帳から、近い候補を出しています。",
    }));
}
