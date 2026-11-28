import { describe, expect, it } from "vitest";
import {
  INSTANT_BALLOT_NONE,
  resolveInstantBallot,
  selectDiverseInstantShortlist,
} from "./ballot";

const candidates = ["r1", "r2", "r3"];

describe("resolveInstantBallot", () => {
  it("selects the restaurant approved by the most people", () => {
    expect(
      resolveInstantBallot({
        candidateIds: candidates,
        votes: [["r1", "r2"], ["r2"], ["r1", "r2"]],
      })
    ).toMatchObject({ status: "winner", winnerId: "r2", tied: false });
  });

  it("breaks a tie by the existing candidate rank", () => {
    expect(
      resolveInstantBallot({ candidateIds: candidates, votes: [["r2"], ["r1"]] })
    ).toMatchObject({ status: "winner", winnerId: "r1", tied: true });
  });

  it("requests a redraw when none matches or exceeds the top candidate", () => {
    expect(
      resolveInstantBallot({
        candidateIds: candidates,
        votes: [["r1"], [INSTANT_BALLOT_NONE], ["r2"]],
      })
    ).toMatchObject({ status: "redraw" });
  });

  it("keeps votes anonymous by returning only aggregate counts", () => {
    const result = resolveInstantBallot({
      candidateIds: candidates,
      votes: [["r1", "r3"], ["r3"], ["r1"]],
    });

    expect(result.counts).toEqual({
      r1: 2,
      r2: 0,
      r3: 2,
      [INSTANT_BALLOT_NONE]: 0,
    });
    expect(JSON.stringify(result)).not.toContain("participant");
  });

  it("counts each restaurant at most once per person's ballot", () => {
    const result = resolveInstantBallot({
      candidateIds: candidates,
      votes: [["r1", "r1", "r2"], ["r2"]],
    });

    expect(result.counts.r1).toBe(1);
    expect(result.counts.r2).toBe(2);
  });

  it("treats none as exclusive even for malformed ballots", () => {
    const result = resolveInstantBallot({
      candidateIds: candidates,
      votes: [["r1", INSTANT_BALLOT_NONE], ["r1"]],
    });

    expect(result.counts.r1).toBe(1);
    expect(result.counts[INSTANT_BALLOT_NONE]).toBe(1);
  });
});

describe("selectDiverseInstantShortlist", () => {
  it("prefers meaningfully different genres while preserving rank order", () => {
    const restaurants = [
      { id: "r1", genreId: "G004" },
      { id: "r2", genreId: "G004" },
      { id: "r3", genreId: "G013" },
      { id: "r4", genreId: "G014" },
    ];

    expect(selectDiverseInstantShortlist(restaurants).map((item) => item.id)).toEqual([
      "r1",
      "r3",
      "r4",
    ]);
  });
});
