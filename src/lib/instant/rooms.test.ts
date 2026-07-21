import { describe, expect, it } from "vitest";
import {
  aggregateRoomTokens,
  normalizeRoomSurvey,
  rankInstantCatalogFallback,
  roomProposalFromShortlist,
  roomStateFromShortlist,
} from "./rooms";
import type { Restaurant } from "@/lib/types";

describe("normalizeRoomSurvey", () => {
  it("maps wish/avoid tokens to stored genre and mood fields", () => {
    expect(
      normalizeRoomSurvey({
        wish: ["G004", "warm"],
        avoid: ["G004", "meat", "unknown"],
        genrePreferences: [{ genreId: "G013", priority: "prefer" }],
        preferMoods: ["fish"],
        dietaryRestrictions: [
          { restrictionId: "vegan", priority: "must" },
        ],
      })
    ).toEqual({
      genrePreferences: [
        { genreId: "G013", priority: "prefer" },
        { genreId: "G004", priority: "avoid" },
        { genreId: "G007", priority: "prefer" },
        { genreId: "G017", priority: "avoid" },
        { genreId: "G005", priority: "avoid" },
        { genreId: "G008", priority: "avoid" },
      ],
      preferMoods: ["fish", "instant:warm"],
      avoidMoods: ["instant:meat"],
      dietaryRestrictions: [
        { restrictionId: "vegan", priority: "must" },
      ],
    });
  });

  it("drops malformed and free-form tokens", () => {
    expect(
      normalizeRoomSurvey({
        wish: ["tell everyone my secret", 42],
        genrePreferences: [{ genreId: "G999", priority: "prefer" }],
        preferMoods: ["not-a-mood"],
      })
    ).toEqual({
      genrePreferences: [],
      preferMoods: [],
      avoidMoods: [],
      dietaryRestrictions: [],
    });
  });
});

describe("aggregateRoomTokens", () => {
  it("returns anonymous counts without participant-level rows", () => {
    expect(
      aggregateRoomTokens([
        {
          genre_preferences: [
            { genreId: "G004", priority: "prefer" },
            { genreId: "G013", priority: "avoid" },
          ],
          prefer_moods: ["instant:warm"],
          avoid_moods: [],
        },
        {
          genre_preferences: [{ genreId: "G004", priority: "prefer" }],
          prefer_moods: ["instant:warm"],
          avoid_moods: ["instant:meat"],
        },
        {
          genre_preferences: [],
          prefer_moods: [],
          avoid_moods: ["instant:meat"],
        },
        { genre_preferences: [], prefer_moods: [], avoid_moods: [] },
        { genre_preferences: [], prefer_moods: [], avoid_moods: [] },
      ])
    ).toEqual({
      wish: [{ token: "warm", count: 2 }],
      avoid: [{ token: "meat", count: 2 }],
    });
  });

  it("hides aggregates for small groups", () => {
    expect(
      aggregateRoomTokens(
        [
          {
            genre_preferences: [],
            prefer_moods: ["instant:warm"],
            avoid_moods: [],
          },
        ],
        4
      )
    ).toEqual({ wish: [], avoid: [] });
  });
});

describe("roomProposalFromShortlist", () => {
  it("accepts only the room proposal envelope", () => {
    const proposal = {
      revision: 0,
      proposedAt: "2026-07-20T00:00:00.000Z",
      restaurant: { id: "r1", name: "店A" },
    };
    expect(
      roomProposalFromShortlist({
        kind: "instant_room_state",
        zone: null,
        proposal,
      })
    ).toEqual(proposal);
    expect(roomProposalFromShortlist([{ id: "r1" }])).toBeNull();
  });

  it("keeps only a coordinate-free zone context", () => {
    expect(
      roomStateFromShortlist({
        kind: "instant_room_state",
        zone: {
          zoneId: "zone-1",
          name: "恵比寿",
          station: "恵比寿駅",
          source: "gps",
          lat: 35.6,
          lng: 139.7,
        },
        proposal: null,
      })
    ).toEqual({
      kind: "instant_room_state",
      zone: {
        zoneId: "zone-1",
        name: "恵比寿",
        station: "恵比寿駅",
        source: "gps",
      },
      proposal: null,
    });
  });

  it("preserves a manual area source without accepting coordinates", () => {
    expect(
      roomStateFromShortlist({
        kind: "instant_room_state",
        zone: {
          zoneId: "shibuya",
          name: "渋谷",
          station: "渋谷駅",
          source: "manual",
          lat: 35.6,
        },
        proposal: null,
      }).zone
    ).toEqual({
      zoneId: "shibuya",
      name: "渋谷",
      station: "渋谷駅",
      source: "manual",
    });
  });
});

describe("rankInstantCatalogFallback", () => {
  const restaurant = (
    id: string,
    name: string,
    genreId: string,
    googleRating: number
  ): Restaurant => ({
    id,
    name,
    genreId,
    genre: "",
    budget: "¥¥",
    matchScore: 0,
    rating: 0,
    access: "",
    hasPrivateRoom: false,
    area: "渋谷",
    address: "東京都渋谷区",
    googleRating,
  });

  it("prioritizes wishes and penalizes avoids before rating", () => {
    const ranked = rankInstantCatalogFallback(
      [
        restaurant("ramen", "ラーメン", "G013", 4.1),
        restaurant("meat", "焼肉", "G008", 4.8),
        restaurant("cafe", "カフェ", "G014", 4.9),
      ],
      [
        {
          genre_preferences: [
            { genreId: "G013", priority: "prefer" },
            { genreId: "G008", priority: "avoid" },
          ],
        },
      ]
    );

    expect(ranked.map((item) => item.id)).toEqual(["ramen", "cafe"]);
    expect(ranked[0].reasonTags).toContain("みんなのWish");
  });

  it("uses rating and a stable name tie-break without preferences", () => {
    const ranked = rankInstantCatalogFallback(
      [
        restaurant("b", "B店", "G004", 4.5),
        restaurant("a", "A店", "G005", 4.5),
        restaurant("c", "C店", "G006", 4.2),
      ],
      [],
      3
    );
    expect(ranked.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("drops numeric names and rows without an address", () => {
    const numeric = restaurant("numeric", "0078946726625", "G013", 5);
    const noAddress = { ...restaurant("no-address", "住所なし店", "G013", 5), address: "" };
    const valid = restaurant("valid", "渋谷ラーメン", "G013", 4);
    expect(
      rankInstantCatalogFallback([numeric, noAddress, valid], []).map((item) => item.id)
    ).toEqual(["valid"]);
  });
});
