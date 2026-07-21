import {
  GENRES,
  type GenreCode,
} from "@/lib/restaurant-taxonomy";
import type { GenrePreferenceInput } from "@/lib/types";

export const INSTANT_OPINION_TOKENS = [
  "warm",
  "meat",
  "light",
  "share",
  "noodles",
  "adventure",
] as const;

export type InstantOpinionToken = (typeof INSTANT_OPINION_TOKENS)[number];
export type InstantOpinionMoodId = `instant:${InstantOpinionToken}`;

export interface InstantOpinionOption {
  id: InstantOpinionToken;
  emoji: string;
  labelJa: string;
  labelEn: string;
  genreIds: readonly GenreCode[];
}

export const INSTANT_OPINIONS = [
  {
    id: "warm",
    emoji: "🍲",
    labelJa: "あったかい",
    labelEn: "Something warm",
    genreIds: ["G004", "G007", "G013", "G017"],
  },
  {
    id: "meat",
    emoji: "🥩",
    labelJa: "肉で満足",
    labelEn: "Meat and satisfying",
    genreIds: ["G005", "G008", "G017"],
  },
  {
    id: "light",
    emoji: "🥗",
    labelJa: "軽め・さっぱり",
    labelEn: "Light and fresh",
    genreIds: ["G004", "G009", "G014"],
  },
  {
    id: "share",
    emoji: "🥢",
    labelJa: "みんなでシェア",
    labelEn: "Plates to share",
    genreIds: ["G001", "G002", "G006", "G007", "G008", "G016", "G017"],
  },
  {
    id: "noodles",
    emoji: "🍜",
    labelJa: "麺がいい",
    labelEn: "Noodles",
    genreIds: ["G006", "G007", "G013"],
  },
  {
    id: "adventure",
    emoji: "✨",
    labelJa: "ちょっと冒険",
    labelEn: "Try something new",
    genreIds: ["G003", "G009", "G010", "G017"],
  },
] as const satisfies readonly InstantOpinionOption[];

export interface InstantOpinionSelection {
  wish: InstantOpinionToken | null;
  avoid: InstantOpinionToken | null;
}

export interface InstantOpinionPayload {
  genrePreferences: GenrePreferenceInput[];
  preferMoods: InstantOpinionMoodId[];
  avoidMoods: InstantOpinionMoodId[];
}

export type InstantOpinionSummary =
  | {
      kind: "hidden";
      wishTokens: readonly [];
      avoidTokens: readonly [];
    }
  | {
      kind: "omakase";
      wishTokens: readonly [];
      avoidTokens: readonly [];
    }
  | {
      kind: "themes";
      wishTokens: readonly InstantOpinionToken[];
      avoidTokens: readonly InstantOpinionToken[];
    };

const MIN_SUMMARY_GROUP_SIZE = 5;
const MIN_SUMMARY_MENTIONS = 2;
const MAX_SUMMARY_TOKENS_PER_KIND = 2;

const optionByToken = new Map(
  INSTANT_OPINIONS.map((option) => [option.id, option])
);
const tokenOrder = new Map(
  INSTANT_OPINION_TOKENS.map((token, index) => [token, index])
);

export function isInstantOpinionToken(
  value: unknown
): value is InstantOpinionToken {
  return (
    typeof value === "string" &&
    (INSTANT_OPINION_TOKENS as readonly string[]).includes(value)
  );
}

export function emptyInstantOpinionSelection(): InstantOpinionSelection {
  return { wish: null, avoid: null };
}

export function createInstantOpinionSelection(params: {
  wish?: InstantOpinionToken | null;
  avoid?: InstantOpinionToken | null;
} = {}): InstantOpinionSelection {
  const selection = {
    wish: params.wish ?? null,
    avoid: params.avoid ?? null,
  };
  assertValidSelection(selection);
  return selection;
}

export function withInstantWish(
  selection: InstantOpinionSelection,
  wish: InstantOpinionToken | null
): InstantOpinionSelection {
  return {
    wish,
    avoid: wish !== null && selection.avoid === wish ? null : selection.avoid,
  };
}

export function withInstantAvoid(
  selection: InstantOpinionSelection,
  avoid: InstantOpinionToken | null
): InstantOpinionSelection {
  return {
    wish: avoid !== null && selection.wish === avoid ? null : selection.wish,
    avoid,
  };
}

export function isInstantOmakase(selection: InstantOpinionSelection): boolean {
  return selection.wish === null && selection.avoid === null;
}

export function buildInstantOpinionPayload(
  selection: InstantOpinionSelection
): InstantOpinionPayload {
  assertValidSelection(selection);

  const priorities = new Map<GenreCode, GenrePreferenceInput["priority"]>();
  if (selection.wish) {
    for (const genreCode of genreCodesFor(selection.wish)) {
      priorities.set(genreCode, "prefer");
    }
  }
  if (selection.avoid) {
    // A boundary wins when two different tokens overlap on a genre.
    for (const genreCode of genreCodesFor(selection.avoid)) {
      priorities.set(genreCode, "avoid");
    }
  }

  return {
    genrePreferences: GENRES.flatMap(({ code }) => {
      const priority = priorities.get(code);
      return priority ? [{ genreId: code, priority }] : [];
    }),
    preferMoods: selection.wish
      ? [moodIdFor(selection.wish)]
      : [],
    avoidMoods: selection.avoid
      ? [moodIdFor(selection.avoid)]
      : [],
  };
}

/**
 * Produces a display-safe group summary:
 * - no summary for groups smaller than five;
 * - no single-mention tokens or counts;
 * - at most two themes per kind, in deterministic order.
 */
export function summarizeInstantOpinions(
  selections: readonly InstantOpinionSelection[]
): InstantOpinionSummary {
  for (const selection of selections) assertValidSelection(selection);

  if (selections.length < MIN_SUMMARY_GROUP_SIZE) {
    return { kind: "hidden", wishTokens: [], avoidTokens: [] };
  }
  if (selections.every(isInstantOmakase)) {
    return { kind: "omakase", wishTokens: [], avoidTokens: [] };
  }

  const wishTokens = summarizedTokens(
    selections.map((selection) => selection.wish)
  );
  const avoidTokens = summarizedTokens(
    selections.map((selection) => selection.avoid)
  );
  if (wishTokens.length === 0 && avoidTokens.length === 0) {
    return { kind: "hidden", wishTokens: [], avoidTokens: [] };
  }

  return { kind: "themes", wishTokens, avoidTokens };
}

function assertValidSelection(selection: InstantOpinionSelection): void {
  if (
    selection.wish !== null &&
    selection.avoid !== null &&
    selection.wish === selection.avoid
  ) {
    throw new RangeError("wish and avoid must use different instant opinion tokens");
  }
}

function genreCodesFor(token: InstantOpinionToken): readonly GenreCode[] {
  const option = optionByToken.get(token);
  if (!option) {
    throw new RangeError(`unknown instant opinion token: ${token}`);
  }
  return option.genreIds;
}

function moodIdFor(token: InstantOpinionToken): InstantOpinionMoodId {
  return `instant:${token}`;
}

function summarizedTokens(
  values: readonly (InstantOpinionToken | null)[]
): InstantOpinionToken[] {
  const counts = new Map<InstantOpinionToken, number>();
  for (const value of values) {
    if (value === null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_SUMMARY_MENTIONS)
    .sort(
      ([leftToken, leftCount], [rightToken, rightCount]) =>
        rightCount - leftCount ||
        (tokenOrder.get(leftToken) ?? Number.MAX_SAFE_INTEGER) -
          (tokenOrder.get(rightToken) ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, MAX_SUMMARY_TOKENS_PER_KIND)
    .map(([token]) => token);
}
