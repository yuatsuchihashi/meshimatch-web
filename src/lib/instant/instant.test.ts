import { describe, expect, it } from "vitest";
import { nearestInstantZoneFromCoordinates } from "./zones";
import { aggregateInstantParticipants, timedOutDraftToParticipant } from "./round";
import { buildInstantGroupCreationRows, containsRawCoordinates } from "./payload";
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
      index: 0,
      draft: {
        nickname: "",
        ngLabels: [],
        genrePreferences: [],
        dietaryRestrictions: [],
      },
    });

    expect(participant.source).toBe("auto");
    expect(participant.nickname).toBe("おまかせ1");
    expect(participant.genrePreferences).toEqual([]);
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
    expect(rows.surveys).toHaveLength(2);
    expect(rows.surveys[0].departure_station).toBe("渋谷駅");
    expect(containsRawCoordinates(rows)).toBe(false);
  });
});
