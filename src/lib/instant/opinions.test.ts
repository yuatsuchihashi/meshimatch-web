import { describe, expect, it } from "vitest";
import { GENRES } from "@/lib/restaurant-taxonomy";
import {
  INSTANT_OPINIONS,
  INSTANT_OPINION_TOKENS,
  buildInstantOpinionPayload,
  createInstantOpinionSelection,
  emptyInstantOpinionSelection,
  isInstantOmakase,
  isInstantOpinionToken,
  summarizeInstantOpinions,
  withInstantAvoid,
  withInstantWish,
  type InstantOpinionSelection,
} from "./opinions";

describe("instant opinion catalog", () => {
  it("exposes six stable, unique user-facing tokens", () => {
    expect(INSTANT_OPINION_TOKENS).toEqual([
      "warm",
      "meat",
      "light",
      "share",
      "noodles",
      "adventure",
    ]);
    expect(new Set(INSTANT_OPINION_TOKENS).size).toBe(
      INSTANT_OPINION_TOKENS.length
    );
    expect(INSTANT_OPINIONS.map((option) => option.id)).toEqual(
      INSTANT_OPINION_TOKENS
    );
  });

  it("maps every token to non-empty, unique, valid taxonomy codes", () => {
    const validCodes = new Set(GENRES.map((genre) => genre.code));

    for (const option of INSTANT_OPINIONS) {
      expect(option.emoji.trim()).not.toBe("");
      expect(option.labelJa.trim()).not.toBe("");
      expect(option.labelEn.trim()).not.toBe("");
      expect(option.genreIds.length).toBeGreaterThan(0);
      expect(new Set(option.genreIds).size).toBe(option.genreIds.length);
      expect(option.genreIds.every((code) => validCodes.has(code))).toBe(true);
    }
  });

  it("recognizes tokens at runtime", () => {
    expect(isInstantOpinionToken("warm")).toBe(true);
    expect(isInstantOpinionToken("ramen")).toBe(false);
    expect(isInstantOpinionToken(null)).toBe(false);
  });
});

describe("instant opinion selection", () => {
  it("starts as omakase", () => {
    const selection = emptyInstantOpinionSelection();

    expect(selection).toEqual({ wish: null, avoid: null });
    expect(isInstantOmakase(selection)).toBe(true);
  });

  it("allows omakase with only an avoid boundary", () => {
    const selection = createInstantOpinionSelection({ avoid: "meat" });

    expect(selection).toEqual({ wish: null, avoid: "meat" });
    expect(isInstantOmakase(selection)).toBe(false);
  });

  it("rejects the same token for wish and avoid", () => {
    expect(() =>
      createInstantOpinionSelection({ wish: "warm", avoid: "warm" })
    ).toThrow(RangeError);
  });

  it("keeps the invariant while changing wish or avoid", () => {
    const initial = createInstantOpinionSelection({
      wish: "warm",
      avoid: "meat",
    });

    expect(withInstantWish(initial, "meat")).toEqual({
      wish: "meat",
      avoid: null,
    });
    expect(withInstantAvoid(initial, "warm")).toEqual({
      wish: null,
      avoid: "warm",
    });
  });
});

describe("buildInstantOpinionPayload", () => {
  it("builds prefer genres and a namespaced mood for one wish", () => {
    const payload = buildInstantOpinionPayload(
      createInstantOpinionSelection({ wish: "noodles" })
    );

    expect(payload).toEqual({
      genrePreferences: [
        { genreId: "G006", priority: "prefer" },
        { genreId: "G007", priority: "prefer" },
        { genreId: "G013", priority: "prefer" },
      ],
      preferMoods: ["instant:noodles"],
      avoidMoods: [],
    });
  });

  it("builds avoid genres and a namespaced mood without requiring a wish", () => {
    const payload = buildInstantOpinionPayload(
      createInstantOpinionSelection({ avoid: "meat" })
    );

    expect(payload).toEqual({
      genrePreferences: [
        { genreId: "G005", priority: "avoid" },
        { genreId: "G008", priority: "avoid" },
        { genreId: "G017", priority: "avoid" },
      ],
      preferMoods: [],
      avoidMoods: ["instant:meat"],
    });
  });

  it("lets avoid win deterministically when different tokens share genres", () => {
    const payload = buildInstantOpinionPayload(
      createInstantOpinionSelection({
        wish: "warm",
        avoid: "noodles",
      })
    );

    expect(payload.genrePreferences).toEqual([
      { genreId: "G004", priority: "prefer" },
      { genreId: "G006", priority: "avoid" },
      { genreId: "G007", priority: "avoid" },
      { genreId: "G013", priority: "avoid" },
      { genreId: "G017", priority: "prefer" },
    ]);
    expect(payload.preferMoods).toEqual(["instant:warm"]);
    expect(payload.avoidMoods).toEqual(["instant:noodles"]);
  });

  it("returns an empty API payload for omakase", () => {
    expect(buildInstantOpinionPayload(emptyInstantOpinionSelection())).toEqual({
      genrePreferences: [],
      preferMoods: [],
      avoidMoods: [],
    });
  });

  it("defends the invariant even if an invalid object bypasses constructors", () => {
    expect(() =>
      buildInstantOpinionPayload({ wish: "share", avoid: "share" })
    ).toThrow(RangeError);
  });
});

describe("summarizeInstantOpinions", () => {
  it("hides every summary for groups smaller than five", () => {
    expect(
      summarizeInstantOpinions([
        selection("warm", null),
        selection("warm", null),
        selection("meat", "light"),
        selection(null, "light"),
      ])
    ).toEqual({ kind: "hidden", wishTokens: [], avoidTokens: [] });
  });

  it("reports omakase without exposing counts", () => {
    expect(
      summarizeInstantOpinions(
        Array.from({ length: 5 }, () => emptyInstantOpinionSelection())
      )
    ).toEqual({ kind: "omakase", wishTokens: [], avoidTokens: [] });
  });

  it("suppresses single mentions and returns no counts", () => {
    const summary = summarizeInstantOpinions([
      selection("warm", "meat"),
      selection("warm", null),
      selection("light", null),
      selection("share", "noodles"),
      selection(null, "noodles"),
    ]);

    expect(summary).toEqual({
      kind: "themes",
      wishTokens: ["warm"],
      avoidTokens: ["noodles"],
    });
    expect(JSON.stringify(summary)).not.toMatch(/count|mention|5/);
  });

  it("caps themes and breaks equal-count ties by catalog order", () => {
    const summary = summarizeInstantOpinions([
      selection("adventure", "noodles"),
      selection("adventure", "noodles"),
      selection("warm", "meat"),
      selection("warm", "meat"),
      selection("light", "share"),
      selection("light", "share"),
    ]);

    expect(summary).toEqual({
      kind: "themes",
      wishTokens: ["warm", "light"],
      avoidTokens: ["meat", "share"],
    });
  });

  it("hides sparse signals that could identify one person", () => {
    expect(
      summarizeInstantOpinions([
        selection("warm", null),
        selection("meat", null),
        selection("light", null),
        selection("share", null),
        selection("adventure", "noodles"),
      ])
    ).toEqual({ kind: "hidden", wishTokens: [], avoidTokens: [] });
  });
});

function selection(
  wish: InstantOpinionSelection["wish"],
  avoid: InstantOpinionSelection["avoid"]
): InstantOpinionSelection {
  return createInstantOpinionSelection({ wish, avoid });
}
