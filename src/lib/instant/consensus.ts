import { DIETARY_PRESETS } from "@/lib/dietary-presets";
import { GENRE_NAMES, type GenreCode } from "@/lib/restaurant-taxonomy";
import type { DietaryRestrictionInput } from "@/lib/types";
import {
  INSTANT_CONSENSUS_CONFIG,
  type InstantConsensusConfig,
  type InstantConsensusMood,
  type InstantConsensusStyle,
} from "./consensus-config";

export type InstantConsensusNg = "none" | "no_heavy" | "no_spicy";

export interface InstantConsensusAnswer<TStyle extends string = InstantConsensusStyle> {
  ng: InstantConsensusNg;
  dietaryRestrictions: DietaryRestrictionInput[];
  mood: InstantConsensusMood | null;
  style: TStyle | null;
}

export interface CandidateSourceCell<TStyle extends string = InstantConsensusStyle> {
  mood: InstantConsensusMood;
  style: TStyle;
  key: string;
}

export interface DerivedCandidateGenre<TStyle extends string = InstantConsensusStyle> {
  genreCode: GenreCode;
  genreName: string;
  violations: number;
  sourceCells: CandidateSourceCell<TStyle>[];
}

export interface InstantConsensusResolution<TStyle extends string = InstantConsensusStyle> {
  proposals: DerivedCandidateGenre<TStyle>[];
  candidates: DerivedCandidateGenre<TStyle>[];
  answeredCount: number;
  hardExcludedGenres: GenreCode[];
}

const DEFAULT_CONSENSUS_CONFIG: InstantConsensusConfig<InstantConsensusStyle> =
  INSTANT_CONSENSUS_CONFIG;
type AnyConsensusStyle = any;

export function resolveConsensus(
  answers: readonly InstantConsensusAnswer[],
  config?: InstantConsensusConfig
): InstantConsensusResolution;
export function resolveConsensus<TStyle extends string>(
  answers: readonly InstantConsensusAnswer<TStyle>[],
  config: InstantConsensusConfig<TStyle>
): InstantConsensusResolution<TStyle>;
export function resolveConsensus(
  answers: readonly InstantConsensusAnswer<AnyConsensusStyle>[],
  config: InstantConsensusConfig<AnyConsensusStyle> = DEFAULT_CONSENSUS_CONFIG
): InstantConsensusResolution<AnyConsensusStyle> {
  const hardExcludedGenres = hardExcludedGenresByDietaryRestrictions(
    answers,
    config.taxonomyOrder
  );
  const candidates = deriveCandidateGenres(answers, config, hardExcludedGenres);

  return {
    proposals: selectTwoProposals(candidates, config),
    candidates,
    answeredCount: countAnsweredParticipants(answers),
    hardExcludedGenres,
  };
}

export function deriveCandidateGenres(
  answers: readonly InstantConsensusAnswer[],
  config?: InstantConsensusConfig,
  hardExcludedGenres?: readonly GenreCode[]
): DerivedCandidateGenre[];
export function deriveCandidateGenres<TStyle extends string>(
  answers: readonly InstantConsensusAnswer<TStyle>[],
  config: InstantConsensusConfig<TStyle>,
  hardExcludedGenres?: readonly GenreCode[]
): DerivedCandidateGenre<TStyle>[];
export function deriveCandidateGenres(
  answers: readonly InstantConsensusAnswer<AnyConsensusStyle>[],
  config: InstantConsensusConfig<AnyConsensusStyle> = DEFAULT_CONSENSUS_CONFIG,
  hardExcludedGenres: readonly GenreCode[] = hardExcludedGenresByDietaryRestrictions(
    answers,
    config.taxonomyOrder
  )
): DerivedCandidateGenre<AnyConsensusStyle>[] {
  if (answers.length === 0) return [];

  const selectedMoods = topVotedValues(
    answers.map((answer) => answer.mood),
    config.moodAxis.options.map((option) => option.value)
  );
  const selectedStyles = topVotedValues(
    answers.map((answer) => answer.style),
    config.secondaryAxis.options.map((option) => option.value)
  );
  const hardExcludedGenreSet = new Set(hardExcludedGenres);
  const candidates = new Map<GenreCode, CandidateSourceCell<AnyConsensusStyle>[]>();

  for (const mood of selectedMoods) {
    for (const style of selectedStyles) {
      const cellGenres = config.secondaryAxis.genreMapByMood[mood][style] ?? [];
      const sourceCell = { mood, style, key: `${mood}:${style}` };

      for (const genreCode of cellGenres) {
        if (hardExcludedGenreSet.has(genreCode)) continue;
        const sourceCells = candidates.get(genreCode) ?? [];
        if (!sourceCells.some((cell) => cell.key === sourceCell.key)) {
          sourceCells.push(sourceCell);
        }
        candidates.set(genreCode, sourceCells);
      }
    }
  }

  const heavyNgCount = answers.filter((answer) => answer.ng === "no_heavy").length;
  const spicyNgCount = answers.filter((answer) => answer.ng === "no_spicy").length;
  const taxonomyRank = taxonomyRankMap(config.taxonomyOrder);

  return Array.from(candidates.entries())
    .map(([genreCode, sourceCells]) => {
      const attributes = config.genreAttributes[genreCode];
      const violations =
        (attributes?.heavy ? heavyNgCount : 0) +
        (attributes?.spicy ? spicyNgCount : 0);

      return {
        genreCode,
        genreName: GENRE_NAMES[genreCode] ?? genreCode,
        violations,
        sourceCells: sortSourceCells(sourceCells),
      };
    })
    .sort((a, b) => taxonomyRank(a.genreCode) - taxonomyRank(b.genreCode));
}

export function selectTwoProposals<TStyle extends string = InstantConsensusStyle>(
  candidates: readonly DerivedCandidateGenre<TStyle>[],
  config: Pick<InstantConsensusConfig<TStyle>, "taxonomyOrder"> = INSTANT_CONSENSUS_CONFIG
): DerivedCandidateGenre<TStyle>[] {
  if (candidates.length <= 1) return [...candidates];

  const taxonomyRank = taxonomyRankMap(config.taxonomyOrder);
  let bestPair: readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>] | null =
    null;

  for (let leftIndex = 0; leftIndex < candidates.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const pair = orderPairByGenre(candidates[leftIndex], candidates[rightIndex], taxonomyRank);
      if (!bestPair || comparePairs(pair, bestPair, taxonomyRank) < 0) {
        bestPair = pair;
      }
    }
  }

  return bestPair ? [...bestPair] : [];
}

function topVotedValues<TValue extends string>(
  values: readonly (TValue | null)[],
  allowedValues: readonly TValue[]
): TValue[] {
  const counts = new Map<TValue, number>();
  for (const allowedValue of allowedValues) counts.set(allowedValue, 0);
  for (const value of values) {
    if (value === null) continue;
    if (counts.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const maxCount = Math.max(...Array.from(counts.values()));
  return allowedValues.filter((value) => counts.get(value) === maxCount);
}

function hardExcludedGenresByDietaryRestrictions<TStyle extends string>(
  answers: readonly InstantConsensusAnswer<TStyle>[],
  taxonomyOrder: readonly GenreCode[]
): GenreCode[] {
  const excluded = new Set<GenreCode>();
  const mustRestrictionIds = answers.flatMap((answer) =>
    answer.dietaryRestrictions
      .filter((restriction) => restriction.priority === "must")
      .map((restriction) => restriction.restrictionId)
  );

  for (const restrictionId of mustRestrictionIds) {
    const preset = DIETARY_PRESETS.find((item) => item.id === restrictionId);
    if (!preset) continue;

    for (const [genreCode, score] of Object.entries(preset.genreScores)) {
      if (score <= -0.75) excluded.add(genreCode as GenreCode);
    }
  }

  const taxonomyRank = taxonomyRankMap(taxonomyOrder);
  return Array.from(excluded).sort((a, b) => taxonomyRank(a) - taxonomyRank(b));
}

function countAnsweredParticipants<TStyle extends string>(
  answers: readonly InstantConsensusAnswer<TStyle>[]
) {
  return answers.filter(
    (answer) =>
      answer.ng !== "none" ||
      answer.dietaryRestrictions.length > 0 ||
      answer.mood !== null ||
      answer.style !== null
  ).length;
}

function taxonomyRankMap(taxonomyOrder: readonly GenreCode[]) {
  const ranks = new Map(taxonomyOrder.map((genreCode, index) => [genreCode, index]));
  return (genreCode: GenreCode) => ranks.get(genreCode) ?? Number.MAX_SAFE_INTEGER;
}

function sortSourceCells<TStyle extends string>(
  cells: readonly CandidateSourceCell<TStyle>[]
): CandidateSourceCell<TStyle>[] {
  return [...cells].sort((a, b) => a.key.localeCompare(b.key));
}

function orderPairByGenre<TStyle extends string>(
  left: DerivedCandidateGenre<TStyle>,
  right: DerivedCandidateGenre<TStyle>,
  taxonomyRank: (genreCode: GenreCode) => number
): readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>] {
  if (taxonomyRank(left.genreCode) <= taxonomyRank(right.genreCode)) return [left, right];
  return [right, left];
}

function comparePairs<TStyle extends string>(
  left: readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>],
  right: readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>],
  taxonomyRank: (genreCode: GenreCode) => number
) {
  const leftByViolation = orderPairByViolation(left, taxonomyRank);
  const rightByViolation = orderPairByViolation(right, taxonomyRank);

  const firstViolationDiff =
    leftByViolation[0].violations - rightByViolation[0].violations;
  if (firstViolationDiff !== 0) return firstViolationDiff;

  const secondViolationDiff =
    leftByViolation[1].violations - rightByViolation[1].violations;
  if (secondViolationDiff !== 0) return secondViolationDiff;

  const diversityDiff = pairCellDiversity(right) - pairCellDiversity(left);
  if (diversityDiff !== 0) return diversityDiff;

  const firstRankDiff =
    taxonomyRank(left[0].genreCode) - taxonomyRank(right[0].genreCode);
  if (firstRankDiff !== 0) return firstRankDiff;

  return taxonomyRank(left[1].genreCode) - taxonomyRank(right[1].genreCode);
}

function orderPairByViolation<TStyle extends string>(
  pair: readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>],
  taxonomyRank: (genreCode: GenreCode) => number
): readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>] {
  const [left, right] = pair;
  if (left.violations !== right.violations) {
    return left.violations < right.violations ? [left, right] : [right, left];
  }
  return orderPairByGenre(left, right, taxonomyRank);
}

function pairCellDiversity<TStyle extends string>(
  pair: readonly [DerivedCandidateGenre<TStyle>, DerivedCandidateGenre<TStyle>]
) {
  return new Set(pair.flatMap((candidate) => candidate.sourceCells.map((cell) => cell.key))).size;
}
