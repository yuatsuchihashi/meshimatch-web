import { describe, expect, it } from "vitest";
import {
  EMPTY_CANDIDATE_POOL,
  composePool,
  computeTrust,
  type RestaurantRow,
  type SourceRow,
} from "@/lib/restaurants/pool";

function source(partial: Partial<SourceRow>): SourceRow {
  return {
    id: "s",
    restaurant_id: "r",
    source_type: "user_favorite",
    visibility: "private",
    added_by: null,
    display_label: null,
    pr: false,
    ...partial,
  };
}

function row(id: string, area = "渋谷"): RestaurantRow {
  return {
    id,
    name: id,
    name_en: null,
    lat: 0,
    lng: 0,
    nearest_area: area,
    genre_id: "G004",
    price_band: "¥3,000〜¥4,000",
    address: null,
    url: null,
    photo_url: null,
    closed: false,
  };
}

describe("trust-ring pool", () => {
  it("keeps only ring 0/1/2 contributors and orders inner rings first", () => {
    const pool = composePool({
      restaurants: [row("r0"), row("r1"), row("r2"), row("ignored")],
      sources: [
        source({ id: "m", restaurant_id: "r0", added_by: "member" }),
        source({
          id: "friend",
          restaurant_id: "r1",
          added_by: "friend",
          visibility: "public",
        }),
        source({
          id: "official",
          restaurant_id: "r2",
          source_type: "endorsement",
          added_by: "official",
          visibility: "public",
          display_label: "公式の推し",
        }),
        source({
          id: "not-followed",
          restaurant_id: "ignored",
          added_by: "stranger",
          visibility: "public",
        }),
      ],
      memberProfileIds: ["member"],
      followedProfileIds: ["friend", "official"],
      verifiedOfficialProfileIds: ["official"],
      profileNamesById: new Map([
        ["member", "Kai"],
        ["friend", "友人"],
        ["official", "公式"],
      ]),
    });

    expect(pool.map((entry) => [entry.restaurant.id, entry.ring])).toEqual([
      ["r0", 0],
      ["r1", 1],
      ["r2", 2],
    ]);
    expect(pool[2].endorsementLabel).toBe("公式の推し");
  });

  it("treats survey 行きたい店 entries as ring 0", () => {
    const pool = composePool({
      restaurants: [row("survey-pick")],
      sources: [],
      memberProfileIds: [],
      surveySuggestions: [
        {
          restaurantId: "survey-pick",
          label: "Kaiのおすすめ",
          recommenderName: "Kai",
        },
      ],
    });

    expect(pool).toHaveLength(1);
    expect(pool[0].ring).toBe(0);
    expect(pool[0].contributorLabels).toContain("Kaiのおすすめ");
  });

  it("adds strength when multiple people recommend the same place", () => {
    const trust = computeTrust({
      sources: [
        source({ id: "1", added_by: "member", restaurant_id: "r" }),
        source({ id: "2", added_by: "friend", restaurant_id: "r", visibility: "public" }),
      ],
      memberProfileIds: ["member"],
      followedProfileIds: ["friend"],
      profileNamesById: new Map([
        ["member", "Kai"],
        ["friend", "友人"],
      ]),
    });

    expect(trust.ring).toBe(0);
    expect(trust.recommendationStrength).toBeGreaterThan(1);
    expect(trust.sourceCount).toBe(2);
  });

  it("exposes an explicit empty-pool marker", () => {
    expect(EMPTY_CANDIDATE_POOL).toEqual({
      status: "empty",
      reason: "no_trust_ring_candidates",
      prompt: "このグループのおすすめがまだ足りません。行きたい店を追加してください。",
    });
  });
});
