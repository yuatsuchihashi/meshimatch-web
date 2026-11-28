import { describe, expect, it } from "vitest";
import {
  buildInstantConsensusAnswer,
  buildInstantParticipantFromConsensus,
  buildInstantParticipantFromWishAvoid,
  emptyInstantConsensusAnswerDraft,
  toggleInstantDietaryRestriction,
} from "./answers";

describe("buildInstantConsensusAnswer", () => {
  it("keeps unanswered timed-out axes as null while preserving answered values", () => {
    const answer = buildInstantConsensusAnswer({
      ...emptyInstantConsensusAnswerDraft(),
      mood: "light",
    });

    expect(answer).toEqual({
      ng: "none",
      dietaryRestrictions: [],
      mood: "light",
      style: null,
    });
  });

  it("maps dietary picker selections to must restrictions on the participant", () => {
    const draft = toggleInstantDietaryRestriction(
      emptyInstantConsensusAnswerDraft(),
      "no_alcohol"
    );
    const participant = buildInstantParticipantFromConsensus({
      id: "p1",
      label: "1人目",
      draft,
    });

    expect(participant.genrePreferences).toEqual([]);
    expect(participant.dietaryRestrictions).toEqual([
      { restrictionId: "no_alcohol", priority: "must" },
    ]);
    expect(participant.consensusAnswer?.dietaryRestrictions).toEqual([
      { restrictionId: "no_alcohol", priority: "must" },
    ]);
  });
});

describe("buildInstantParticipantFromWishAvoid", () => {
  it("stores one wish and one private avoid without exposing a real name", () => {
    const participant = buildInstantParticipantFromWishAvoid({
      id: "p1",
      label: "1人目",
      wishGenreIds: ["G004", "G013"],
      avoidLabels: ["辛いもの", "重いもの"],
      avoidGenreIds: ["G009", "G017"],
      dietaryRestrictions: [],
    });

    expect(participant.genrePreferences).toEqual([
      { genreId: "G004", priority: "prefer" },
      { genreId: "G013", priority: "prefer" },
      { genreId: "G009", priority: "avoid" },
      { genreId: "G017", priority: "avoid" },
    ]);
    expect(participant.ngLabels).toEqual(["辛いもの", "重いもの"]);
    expect(participant.nickname).toBe("1人目");
  });

  it("deduplicates an avoid that also maps to a hard restriction", () => {
    const participant = buildInstantParticipantFromWishAvoid({
      id: "p1",
      label: "1人目",
      wishGenreIds: [],
      avoidLabels: ["お酒中心"],
      avoidRestrictionIds: ["no_alcohol"],
      dietaryRestrictions: [{ restrictionId: "no_alcohol", priority: "must" }],
    });

    expect(participant.dietaryRestrictions).toEqual([
      { restrictionId: "no_alcohol", priority: "must" },
    ]);
  });
});
