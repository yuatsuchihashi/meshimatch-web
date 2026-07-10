import { describe, expect, it } from "vitest";
import { buildSuggestedRestaurantPayload } from "@/lib/suggestions";

describe("buildSuggestedRestaurantPayload", () => {
  const picks = [{ id: "r1", name: "店A", showName: false }];

  it("allows verified users to mark PR suggestions", () => {
    expect(
      buildSuggestedRestaurantPayload({
        picks,
        showName: true,
        isVerified: true,
        pr: true,
      })
    ).toEqual([{ id: "r1", name: "店A", showName: true, pr: true }]);
  });

  it("forces non-verified suggestion PR flags to false", () => {
    expect(
      buildSuggestedRestaurantPayload({
        picks,
        showName: true,
        isVerified: false,
        pr: true,
      })[0].pr
    ).toBe(false);
  });
});
