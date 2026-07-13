import { GENRES } from "@/lib/restaurant-taxonomy";
import type { InstantParticipantInput } from "./types";

export const INSTANT_TURN_ACCENTS = [
  "turnSage",
  "turnHoney",
  "turnBlush",
  "turnMint",
  "turnPeach",
] as const;

export type InstantTurnAccent = (typeof INSTANT_TURN_ACCENTS)[number];

export interface InstantWinningGenre {
  genreId: string;
  name: string;
  icon: string;
  votes: number;
  isFallback: boolean;
}

const FALLBACK_GENRE_ID = "G015";

export function instantTurnAccent(index: number): InstantTurnAccent {
  return INSTANT_TURN_ACCENTS[
    Math.abs(index) % INSTANT_TURN_ACCENTS.length
  ];
}

export function selectInstantWinningGenre(
  participants: InstantParticipantInput[]
): InstantWinningGenre {
  const taxonomyIndex = new Map<string, number>(
    GENRES.map((genre, index) => [genre.code, index])
  );
  const stats = new Map<string, { votes: number; firstIndex: number }>();

  participants.forEach((participant, participantIndex) => {
    const seenInTurn = new Set<string>();
    for (const preference of participant.genrePreferences) {
      if (seenInTurn.has(preference.genreId)) continue;
      seenInTurn.add(preference.genreId);
      const current = stats.get(preference.genreId);
      if (!current) {
        stats.set(preference.genreId, { votes: 1, firstIndex: participantIndex });
        continue;
      }
      current.votes += 1;
    }
  });

  const [winnerId, winnerStats] =
    [...stats.entries()].sort((a, b) => {
      const [aId, aStats] = a;
      const [bId, bStats] = b;
      return (
        bStats.votes - aStats.votes ||
        aStats.firstIndex - bStats.firstIndex ||
        (taxonomyIndex.get(aId) ?? Number.MAX_SAFE_INTEGER) -
          (taxonomyIndex.get(bId) ?? Number.MAX_SAFE_INTEGER)
      );
    })[0] ?? [];

  const genre =
    GENRES.find((item) => item.code === winnerId) ??
    GENRES.find((item) => item.code === FALLBACK_GENRE_ID) ??
    GENRES[0];

  return {
    genreId: genre.code,
    name: genre.name,
    icon: genre.icon,
    votes: winnerStats?.votes ?? 0,
    isFallback: !winnerId,
  };
}

export function didInstantWinnerChange(
  previous: InstantWinningGenre | null | undefined,
  current: InstantWinningGenre
) {
  return Boolean(previous && previous.genreId !== current.genreId);
}
