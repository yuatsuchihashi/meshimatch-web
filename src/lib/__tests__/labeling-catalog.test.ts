import { describe, expect, it } from "vitest";
import { getLabelingCatalogRestaurants } from "@/lib/labeling/catalog";

describe("labeling catalog", () => {
  it("uses founder-provided label seeds before R6a fixtures", () => {
    const restaurants = getLabelingCatalogRestaurants();

    expect(restaurants).toHaveLength(30);
    expect(restaurants[0]).toMatchObject({
      external_id: "0x60188bc94e7e0b17:0xefee4d3e47e50960",
      place_id: "0x60188bc94e7e0b17:0xefee4d3e47e50960",
      name: "アルデバラン",
      area: "創業者seed",
      price_band: "未取得",
      rating: null,
      rating_count: null,
      reviews: [],
      photo_refs: [],
      lat: 35.6589673,
      lng: 139.7189533,
      source: "label_seed",
    });
    expect(restaurants[0].resolved_url).toContain("https://www.google.com/maps/place/");
  });
});
