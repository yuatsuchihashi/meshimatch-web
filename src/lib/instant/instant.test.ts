import { describe, expect, it } from "vitest";
import { nearestInstantZoneFromCoordinates } from "./zones";
import {
  aggregateInstantParticipants,
  shouldRetryInstantFinalize,
  timedOutDraftToParticipant,
} from "./round";
import { buildInstantGroupCreationRows, containsRawCoordinates } from "./payload";
import { INSTANT_NG_PRESETS, toggleInstantNgDraft } from "./ng";
import {
  didInstantWinnerChange,
  instantTurnAccent,
  selectInstantWinningGenre,
} from "./winner";
import type { InstantParticipantInput } from "./types";

describe("nearestInstantZoneFromCoordinates", () => {
  it("resolves coordinates to the nearest representative zone", () => {
    const zone = nearestInstantZoneFromCoordinates({
      lat: 35.6581,
      lng: 139.7017,
    });

    expect(zone.zoneId).toBe("shibuya");
    expect(zone.station).toBe("渋谷駅");
    expect(zone.source).toBe("gps");
  });
});

describe("aggregateInstantParticipants", () => {
  it("counts preferences without exposing participant names", () => {
    const participants: InstantParticipantInput[] = [
      {
        id: "a",
        nickname: "Kai",
        source: "manual",
        ngLabels: ["辛いのNG"],
        genrePreferences: [{ genreId: "G004", priority: "prefer" }],
        dietaryRestrictions: [],
      },
      {
        id: "b",
        nickname: "Fable",
        source: "manual",
        ngLabels: ["辛いのNG"],
        genrePreferences: [{ genreId: "G004", priority: "prefer" }],
        dietaryRestrictions: [],
      },
    ];

    const aggregate = aggregateInstantParticipants(participants);
    expect(aggregate.ng).toContainEqual({ label: "辛いのNG", count: 2 });
    expect(JSON.stringify(aggregate)).not.toContain("Kai");
    expect(JSON.stringify(aggregate)).not.toContain("Fable");
  });
});

describe("timedOutDraftToParticipant", () => {
  it("turns an expired empty round into auto omakase", () => {
    const participant = timedOutDraftToParticipant({
      id: "p1",
      label: "Person 1",
      draft: {
        ngLabels: [],
        genrePreferences: [],
        dietaryRestrictions: [],
      },
    });

    expect(participant.source).toBe("auto");
    expect(participant.nickname).toBe("Person 1");
    expect(participant.genrePreferences).toEqual([]);
  });
});

describe("shouldRetryInstantFinalize", () => {
  it("retries finalize when a full round already exists after a failed POST", () => {
    expect(
      shouldRetryInstantFinalize({ participantsLength: 3, partySize: 3 })
    ).toBe(true);
    expect(
      shouldRetryInstantFinalize({ participantsLength: 2, partySize: 3 })
    ).toBe(false);
  });
});

describe("toggleInstantNgDraft", () => {
  it("maps the no-alcohol chip back to a must dietary restriction", () => {
    const noAlcohol = INSTANT_NG_PRESETS.find(
      (preset) => preset.key === "instant.ngAlcohol"
    );
    expect(noAlcohol).toBeDefined();
    const draft = toggleInstantNgDraft(
      { ngLabels: [], genrePreferences: [], dietaryRestrictions: [] },
      noAlcohol!,
      "お酒なし"
    );

    expect(draft.ngLabels).toEqual(["お酒なし"]);
    expect(draft.dietaryRestrictions).toEqual([
      { restrictionId: "no_alcohol", priority: "must" },
    ]);
  });
});

describe("selectInstantWinningGenre", () => {
  it("selects the most voted genre", () => {
    const winner = selectInstantWinningGenre([
      participant("p1", ["G013"]),
      participant("p2", ["G013"]),
      participant("p3", ["G004"]),
    ]);

    expect(winner.genreId).toBe("G013");
    expect(winner.name).toBe("ラーメン");
    expect(winner.votes).toBe(2);
  });

  it("breaks vote ties by the genre answered earliest", () => {
    const winner = selectInstantWinningGenre([
      participant("p1", ["G004"]),
      participant("p2", ["G013"]),
    ]);

    expect(winner.genreId).toBe("G004");
  });

  it("re-aggregates when a later participant changes the winner", () => {
    const firstWinner = selectInstantWinningGenre([
      participant("p1", ["G004"]),
      participant("p2", ["G013"]),
    ]);
    const nextWinner = selectInstantWinningGenre([
      participant("p1", ["G004"]),
      participant("p2", ["G013"]),
      participant("p3", ["G013"]),
    ]);

    expect(nextWinner.genreId).toBe("G013");
    expect(didInstantWinnerChange(firstWinner, nextWinner)).toBe(true);
  });

  it("marks all-omakase rounds as a zero-vote fallback", () => {
    const winner = selectInstantWinningGenre([
      participant("p1", []),
      participant("p2", []),
    ]);

    expect(winner.isFallback).toBe(true);
    expect(winner.genreId).toBe("G015");
    expect(winner.votes).toBe(0);
  });
});

describe("instantTurnAccent", () => {
  it("rotates turn background accents deterministically", () => {
    expect([
      instantTurnAccent(0),
      instantTurnAccent(1),
      instantTurnAccent(2),
      instantTurnAccent(3),
      instantTurnAccent(4),
      instantTurnAccent(5),
    ]).toEqual([
      "turnSage",
      "turnHoney",
      "turnBlush",
      "turnMint",
      "turnPeach",
      "turnSage",
    ]);
  });
});

describe("buildInstantGroupCreationRows", () => {
  it("creates instant rows with mode and no raw coordinates", () => {
    const rows = buildInstantGroupCreationRows({
      zone: {
        zoneId: "shibuya",
        name: "渋谷",
        station: "渋谷駅",
        source: "gps",
      },
      partySize: 2,
      createdBy: "user-1",
      nowIso: "2026-07-12T10:00:00.000Z",
      participants: [
        {
          id: "p1",
          nickname: "Kai",
          profileId: "user-1",
          source: "manual",
          ngLabels: [],
          genrePreferences: [],
          dietaryRestrictions: [],
        },
        {
          id: "p2",
          nickname: "Guest",
          source: "manual",
          ngLabels: ["そばNG"],
          genrePreferences: [],
          dietaryRestrictions: [],
        },
      ],
    });

    expect(rows.group.mode).toBe("instant");
    expect(rows.group.group_size).toBe(2);
    expect(rows.members[0].profile_id).toBe("user-1");
    expect(rows.members[1].profile_id).toBeNull();
    expect(rows.surveys).toHaveLength(2);
    expect(rows.surveys[0].departure_station).toBe("渋谷駅");
    expect(containsRawCoordinates(rows)).toBe(false);
  });

  it("allows a locationless instant group without storing a station", () => {
    const rows = buildInstantGroupCreationRows({
      zone: null,
      partySize: 2,
      createdBy: "user-1",
      nowIso: "2026-07-12T10:00:00.000Z",
      participants: [
        participant("p1", ["G013"]),
        participant("p2", ["G013"]),
      ],
    });

    expect(rows.surveys[0].departure_station).toBeNull();
    expect(rows.surveys[0].departure_area).toBeNull();
    expect(rows.surveys[0].preferred_areas).toEqual([]);
    expect(containsRawCoordinates(rows)).toBe(false);
  });
});

function participant(id: string, genreIds: string[]): InstantParticipantInput {
  return {
    id,
    nickname: id,
    source: "manual",
    ngLabels: [],
    genrePreferences: genreIds.map((genreId) => ({
      genreId,
      priority: "prefer" as const,
    })),
    dietaryRestrictions: [],
  };
}
