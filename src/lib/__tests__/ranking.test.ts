import { describe, expect, it } from "vitest";
import {
  RANKING_PRESETS,
  ZONE_ADJACENCY,
  accessPenaltyForRestaurant,
  getRankingPreset,
  rankCandidatePool,
} from "@/lib/recommendation/ranking";
import { INITIAL_ZONES } from "@/lib/areas";
import { composePool, type RestaurantRow, type SourceRow } from "@/lib/restaurants/pool";
import type { Restaurant, SurveyResponse } from "@/lib/types";

function source(partial: Partial<SourceRow>): SourceRow {
  return {
    id: "s",
    restaurant_id: "r",
    source_type: "user_favorite",
    visibility: "private",
    added_by: "member",
    display_label: null,
    pr: false,
    ...partial,
  };
}

function row(overrides: Partial<RestaurantRow>): RestaurantRow {
  return {
    id: "r",
    name: "テスト食堂",
    name_en: null,
    lat: 0,
    lng: 0,
    nearest_area: "渋谷",
    genre_id: "G004",
    price_band: "¥3,000〜¥4,000",
    address: null,
    url: null,
    photo_url: null,
    closed: false,
    ...overrides,
  };
}

function survey(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  return {
    id: "s",
    memberName: "Kai",
    memberId: "member",
    preferredAreas: [],
    departureArea: null,
    departureStation: "渋谷駅",
    preferredArea: null,
    submittedAt: new Date("2026-07-10T10:00:00Z"),
    ...overrides,
  };
}

function rankTwo(restaurants: RestaurantRow[], sources: SourceRow[]) {
  const pooled = composePool({
    restaurants,
    sources,
    memberProfileIds: ["member"],
    profileNamesById: new Map([["member", "Kai"]]),
  });
  return rankCandidatePool({
    pooled,
    mode: "planned",
    surveys: [survey()],
    groupGenreScores: {
      G004: { genreId: "G004", genreName: "和食", score: 1, normalizedScore: 1 },
    },
    groupSize: 2,
    sessionAtmosphere: null,
    sessionFocus: null,
  });
}

describe("ranking presets", () => {
  it("selects instant weights from group mode and defaults to planned", () => {
    expect(getRankingPreset("instant")).toBe(RANKING_PRESETS.instant);
    expect(getRankingPreset("planned")).toBe(RANKING_PRESETS.planned);
    expect(getRankingPreset(undefined)).toBe(RANKING_PRESETS.planned);
    expect(RANKING_PRESETS.instant.wAccess).toBeGreaterThan(RANKING_PRESETS.planned.wAccess);
    expect(RANKING_PRESETS.instant.openNowHardFilter).toBe(true);
  });
});

describe("access scoring", () => {
  it("uses the worst member distance and skips members without stations", () => {
    const restaurant: Pick<Restaurant, "area"> = { area: "渋谷" };

    expect(accessPenaltyForRestaurant(restaurant, ["渋谷駅", null])).toBe(0);
    expect(accessPenaltyForRestaurant(restaurant, ["渋谷駅", "恵比寿駅"])).toBe(1);
    expect(accessPenaltyForRestaurant(restaurant, ["渋谷駅", "上野駅"])).toBe(2);
  });
});

describe("rankCandidatePool", () => {
  it("demotes PR below an otherwise equal non-PR candidate", () => {
    const ranked = rankTwo(
      [row({ id: "non-pr" }), row({ id: "pr" })],
      [
        source({ id: "a", restaurant_id: "non-pr", pr: false }),
        source({ id: "b", restaurant_id: "pr", pr: true }),
      ]
    );

    expect(ranked.map((restaurant) => restaurant.id)).toEqual(["non-pr", "pr"]);
    expect(ranked[1].pr).toBe(true);
    expect(ranked[1].reasonTags).toContain("PR");
  });

  it("hard-filters known closed restaurants only in instant mode", () => {
    const pooled = composePool({
      restaurants: [
        row({
          id: "closed",
          opening_hours: { openNow: false },
        }),
      ],
      sources: [source({ restaurant_id: "closed" })],
      memberProfileIds: ["member"],
    });
    const common = {
      pooled,
      surveys: [survey()],
      groupGenreScores: {},
      groupSize: 2,
      sessionAtmosphere: null,
      sessionFocus: null,
    };

    expect(rankCandidatePool({ ...common, mode: "instant" })).toHaveLength(0);
    expect(rankCandidatePool({ ...common, mode: "planned" })).toHaveLength(1);
  });

  it("hard-filters izakaya candidates when no-alcohol is a must restriction", () => {
    const pooled = composePool({
      restaurants: [
        row({ id: "izakaya-old", genre_id: "G008" }),
        row({ id: "izakaya-instant", genre_id: "G001" }),
        row({ id: "ramen", genre_id: "G014" }),
      ],
      sources: [
        source({ id: "old", restaurant_id: "izakaya-old" }),
        source({ id: "instant", restaurant_id: "izakaya-instant" }),
        source({ id: "ramen", restaurant_id: "ramen" }),
      ],
      memberProfileIds: ["member"],
    });

    const ranked = rankCandidatePool({
      pooled,
      mode: "instant",
      surveys: [
        survey({
          dietaryRestrictions: [{ restrictionId: "no_alcohol", priority: "must" }],
        }),
      ],
      groupGenreScores: {},
      groupSize: 2,
      sessionAtmosphere: null,
      sessionFocus: null,
    });

    expect(ranked.map((restaurant) => restaurant.id)).toEqual(["ramen"]);
  });
});


describe("ZONE_ADJACENCY table", () => {
  it("is total and symmetric over the zone master", () => {
    const zoneIds = new Set(INITIAL_ZONES.map((zone) => zone.id));
    for (const [zone, neighbors] of Object.entries(ZONE_ADJACENCY)) {
      expect(zoneIds.has(zone)).toBe(true);
      for (const neighbor of neighbors) {
        expect(zoneIds.has(neighbor)).toBe(true);
        // 対称性: A→B が隣接なら B→A も隣接
        expect(ZONE_ADJACENCY[neighbor]).toContain(zone);
      }
    }
    // 全ゾーンが表に載っている (漏れたゾーンは常に距離2になる)
    for (const zone of zoneIds) {
      expect(Object.keys(ZONE_ADJACENCY)).toContain(zone);
    }
  });
});
