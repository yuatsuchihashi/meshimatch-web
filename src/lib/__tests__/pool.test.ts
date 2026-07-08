import { describe, expect, it } from "vitest";
import { computeTrust, type SourceRow } from "@/lib/restaurants/pool";

function source(partial: Partial<SourceRow>): SourceRow {
  return {
    id: "s",
    restaurant_id: "r",
    source_type: "user_favorite",
    visibility: "private",
    added_by: null,
    display_label: null,
    ...partial,
  };
}

describe("computeTrust", () => {
  it("boosts member favorites the most", () => {
    const trust = computeTrust({
      sources: [source({ source_type: "user_favorite", added_by: "me" })],
      memberProfileIds: ["me"],
    });
    expect(trust.isMemberFavorite).toBe(true);
    expect(trust.trustBoost).toBeCloseTo(0.35);
  });

  it("counts public favorites from non-members, capped at 0.15", () => {
    const sources = ["a", "b", "c", "d", "e"].map((uid) =>
      source({ visibility: "public", added_by: uid, id: uid })
    );
    const trust = computeTrust({ sources, memberProfileIds: ["me"] });
    expect(trust.isMemberFavorite).toBe(false);
    expect(trust.publicFavoriteCount).toBe(5);
    expect(trust.trustBoost).toBeCloseTo(0.15); // 0.05*5 → cap 0.15
  });

  it("exposes endorsement label only when public", () => {
    const pub = computeTrust({
      sources: [
        source({
          source_type: "endorsement",
          visibility: "public",
          display_label: "グルメ太郎のおすすめ！",
        }),
      ],
      memberProfileIds: [],
    });
    expect(pub.endorsementLabel).toBe("グルメ太郎のおすすめ！");
    expect(pub.trustBoost).toBeCloseTo(0.15);

    const priv = computeTrust({
      sources: [
        source({
          source_type: "endorsement",
          visibility: "private",
          display_label: "x",
        }),
      ],
      memberProfileIds: [],
    });
    expect(priv.endorsementLabel).toBeNull();
  });

  it("stacks curated + endorsement + member favorite", () => {
    const trust = computeTrust({
      sources: [
        source({ source_type: "base_curated", id: "1" }),
        source({
          source_type: "endorsement",
          visibility: "public",
          display_label: "L",
          id: "2",
        }),
        source({ source_type: "user_favorite", added_by: "me", id: "3" }),
      ],
      memberProfileIds: ["me"],
    });
    expect(trust.trustBoost).toBeCloseTo(0.35 + 0.15 + 0.1);
  });
});
