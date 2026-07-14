import { describe, expect, it } from "vitest";
import {
  INSTANT_CONSENSUS_CONFIG,
  type InstantConsensusConfig,
  type InstantConsensusStyle,
} from "./consensus-config";
import {
  deriveCandidateGenres,
  resolveConsensus,
  selectTwoProposals,
  type DerivedCandidateGenre,
  type InstantConsensusAnswer,
} from "./consensus";

describe("deriveCandidateGenres", () => {
  it("derives the majority mood/style cell", () => {
    const candidates = deriveCandidateGenres([
      answer({ mood: "light", style: "own" }),
      answer({ mood: "light", style: "own" }),
      answer({ mood: "hearty", style: "share" }),
    ]);

    expect(codes(candidates)).toEqual(["G004", "G009", "G014", "G015"]);
  });

  it("uses the union of both cells when an axis is tied", () => {
    const candidates = deriveCandidateGenres([
      answer({ mood: "light", style: "own" }),
      answer({ mood: "hearty", style: "own" }),
    ]);

    expect(codes(candidates)).toEqual([
      "G004",
      "G005",
      "G009",
      "G013",
      "G014",
      "G015",
    ]);
  });

  it("removes G001 for a must no_alcohol hard restriction", () => {
    const candidates = deriveCandidateGenres([
      answer({
        mood: "hearty",
        style: "share",
        dietaryRestrictions: [{ restrictionId: "no_alcohol", priority: "must" }],
      }),
      answer({ mood: "hearty", style: "share" }),
    ]);

    expect(codes(candidates)).not.toContain("G001");
    expect(codes(candidates)).toContain("G008");
  });

  it("removes yakiniku for a must vegan hard restriction", () => {
    const candidates = deriveCandidateGenres([
      answer({
        mood: "hearty",
        style: "share",
        dietaryRestrictions: [{ restrictionId: "vegan", priority: "must" }],
      }),
      answer({ mood: "hearty", style: "share" }),
    ]);

    expect(codes(candidates)).not.toContain("G008");
  });

  it("counts no_heavy as violations instead of excluding heavy genres", () => {
    const candidates = deriveCandidateGenres([
      answer({ ng: "no_heavy", mood: "light", style: "share" }),
      answer({ ng: "no_heavy", mood: "hearty", style: "share" }),
    ]);
    const yakiniku = candidates.find((candidate) => candidate.genreCode === "G008");
    const proposals = selectTwoProposals(candidates);

    expect(yakiniku?.violations).toBe(2);
    expect(codes(candidates)).toContain("G008");
    expect(codes(proposals)).toEqual(["G002", "G009"]);
  });

  it("counts no_spicy and adds heavy/spicy violations on the same genre", () => {
    const candidates = deriveCandidateGenres([
      answer({ ng: "no_heavy", mood: "hearty", style: "share" }),
      answer({ ng: "no_spicy", mood: "hearty", style: "share" }),
    ]);

    expect(candidates.find((candidate) => candidate.genreCode === "G007")?.violations).toBe(2);
    expect(candidates.find((candidate) => candidate.genreCode === "G017")?.violations).toBe(2);
    expect(candidates.find((candidate) => candidate.genreCode === "G008")?.violations).toBe(1);
  });

  it("uses the union of all four cells when both axes are tied", () => {
    const candidates = deriveCandidateGenres([
      answer({ mood: "light", style: "own" }),
      answer({ mood: "hearty", style: "share" }),
    ]);

    expect(codes(candidates)).toEqual([
      "G001",
      "G002",
      "G004",
      "G005",
      "G006",
      "G007",
      "G008",
      "G009",
      "G010",
      "G013",
      "G014",
      "G015",
      "G017",
    ]);
  });

  it("ignores null abstentions for an axis and unions all cells when an axis has no votes", () => {
    const candidates = deriveCandidateGenres([
      answer({ mood: null, style: "own" }),
      answer({ mood: null, style: "own" }),
    ]);

    expect(codes(candidates)).toEqual([
      "G004",
      "G005",
      "G009",
      "G013",
      "G014",
      "G015",
    ]);

    const withMoodVote = deriveCandidateGenres([
      answer({ mood: null, style: "share" }),
      answer({ mood: "hearty", style: "share" }),
    ]);

    expect(codes(withMoodVote)).toEqual(["G001", "G006", "G007", "G008", "G017"]);
  });

  it("works when the second axis config is replaced", () => {
    type Familiarity = "safe" | "new";
    const familiarityConfig: InstantConsensusConfig<Familiarity> = {
      ...INSTANT_CONSENSUS_CONFIG,
      secondaryAxis: {
        id: "style",
        questionKey: "instant.consensus.familiarity",
        options: [
          { value: "safe", label: "いつもの安心" },
          { value: "new", label: "ちょっと新しいもの" },
        ],
        genreMapByMood: {
          light: {
            safe: ["G004", "G014"],
            new: ["G009", "G010"],
          },
          hearty: {
            safe: ["G013", "G005"],
            new: ["G017", "G007"],
          },
        },
      },
    };

    const candidates = deriveCandidateGenres(
      [
        answer<Familiarity>({ mood: "light", style: "new" }),
        answer<Familiarity>({ mood: "light", style: "new" }),
        answer<Familiarity>({ mood: "hearty", style: "safe" }),
      ],
      familiarityConfig
    );

    expect(codes(candidates)).toEqual(["G009", "G010"]);
  });
});

describe("resolveConsensus", () => {
  it("distinguishes hard-excluded empty candidates from unanswered rounds", () => {
    const hardExcludedOnlyConfig: InstantConsensusConfig = {
      ...INSTANT_CONSENSUS_CONFIG,
      secondaryAxis: {
        ...INSTANT_CONSENSUS_CONFIG.secondaryAxis,
        genreMapByMood: {
          light: {
            own: ["G001", "G002", "G012"],
            share: ["G001", "G002", "G012"],
          },
          hearty: {
            own: ["G001", "G002", "G012"],
            share: ["G001", "G002", "G012"],
          },
        },
      },
    };

    const excluded = resolveConsensus(
      [
        answer({
          dietaryRestrictions: [{ restrictionId: "no_alcohol", priority: "must" }],
        }),
      ],
      hardExcludedOnlyConfig
    );
    const unanswered = resolveConsensus([
      answer<InstantConsensusStyle>({ mood: null, style: null }),
    ]);

    expect(excluded.candidates).toEqual([]);
    expect(excluded.proposals).toEqual([]);
    expect(excluded.answeredCount).toBe(1);
    expect(excluded.hardExcludedGenres).toEqual(["G001", "G002", "G012"]);
    expect(unanswered.answeredCount).toBe(0);
    expect(unanswered.candidates.length).toBeGreaterThan(0);
  });

  it("returns proposals, candidates, answeredCount, and hardExcludedGenres with one config", () => {
    const result = resolveConsensus([
      answer({
        mood: "hearty",
        style: "share",
        dietaryRestrictions: [{ restrictionId: "no_alcohol", priority: "must" }],
      }),
      answer({ mood: "hearty", style: "share" }),
    ]);

    expect(result.answeredCount).toBe(2);
    expect(result.hardExcludedGenres).toEqual(["G001", "G002", "G012"]);
    expect(codes(result.candidates)).toEqual(["G006", "G007", "G008", "G017"]);
    expect(codes(result.proposals)).toEqual(["G006", "G007"]);
  });
});

describe("selectTwoProposals", () => {
  it("breaks ties deterministically by diversity before taxonomy order", () => {
    const candidates: DerivedCandidateGenre[] = [
      candidate("G004", ["light:own"]),
      candidate("G009", ["light:own"]),
      candidate("G014", ["hearty:own"]),
    ];

    const first = selectTwoProposals(candidates);
    const second = selectTwoProposals(candidates);

    expect(codes(first)).toEqual(["G004", "G014"]);
    expect(codes(second)).toEqual(["G004", "G014"]);
  });

  it("returns one proposal or none when fewer than two candidates exist", () => {
    expect(codes(selectTwoProposals([candidate("G004", ["light:own"])]))).toEqual([
      "G004",
    ]);
    expect(selectTwoProposals([])).toEqual([]);
  });
});

function answer<TStyle extends string = InstantConsensusStyle>(
  overrides: Partial<InstantConsensusAnswer<TStyle>> = {}
): InstantConsensusAnswer<TStyle> {
  return {
    ng: "none",
    dietaryRestrictions: [],
    mood: "light",
    style: "own" as TStyle,
    ...overrides,
  };
}

function candidate(
  genreCode: DerivedCandidateGenre["genreCode"],
  sourceCellKeys: `${DerivedCandidateGenre["sourceCells"][number]["mood"]}:${InstantConsensusStyle}`[],
  violations = 0
): DerivedCandidateGenre {
  return {
    genreCode,
    genreName: genreCode,
    violations,
    sourceCells: sourceCellKeys.map((key) => {
      const [mood, style] = key.split(":");
      return {
        mood: mood as DerivedCandidateGenre["sourceCells"][number]["mood"],
        style: style as InstantConsensusStyle,
        key,
      };
    }),
  };
}

function codes(candidates: readonly Pick<DerivedCandidateGenre, "genreCode">[]) {
  return candidates.map((candidate) => candidate.genreCode);
}
