import { describe, expect, it } from "vitest";
import {
  buildInstantConsensusAnswer,
  buildInstantParticipantFromConsensus,
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
