export const INSTANT_BALLOT_NONE = "__none__";

export type InstantBallotResolution =
  | {
      status: "winner";
      winnerId: string;
      counts: Record<string, number>;
      tied: boolean;
    }
  | {
      status: "redraw";
      counts: Record<string, number>;
      tied: false;
    };

export function selectDiverseInstantShortlist<
  T extends { id: string; genreId: string },
>(restaurants: T[], offset = 0, limit = 3): T[] {
  if (restaurants.length <= limit) return restaurants;
  const normalizedOffset = ((offset % restaurants.length) + restaurants.length) % restaurants.length;
  const rotated = [
    ...restaurants.slice(normalizedOffset),
    ...restaurants.slice(0, normalizedOffset),
  ];
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const genres = new Set<string>();

  for (const restaurant of rotated) {
    if (selected.length >= limit) break;
    if (genres.has(restaurant.genreId)) continue;
    selected.push(restaurant);
    selectedIds.add(restaurant.id);
    genres.add(restaurant.genreId);
  }

  for (const restaurant of rotated) {
    if (selected.length >= limit) break;
    if (selectedIds.has(restaurant.id)) continue;
    selected.push(restaurant);
    selectedIds.add(restaurant.id);
  }

  return selected;
}

export function resolveInstantBallot(params: {
  candidateIds: string[];
  votes: readonly (readonly string[])[];
}): InstantBallotResolution {
  const counts = Object.fromEntries(
    [...params.candidateIds, INSTANT_BALLOT_NONE].map((id) => [id, 0])
  );

  for (const ballot of params.votes) {
    const normalized = ballot.includes(INSTANT_BALLOT_NONE)
      ? [INSTANT_BALLOT_NONE]
      : [...new Set(ballot)];
    for (const vote of normalized) {
      if (vote in counts) counts[vote] += 1;
    }
  }

  const highestCandidateVotes = Math.max(
    0,
    ...params.candidateIds.map((id) => counts[id] ?? 0)
  );
  const noneVotes = counts[INSTANT_BALLOT_NONE] ?? 0;
  if (noneVotes > 0 && noneVotes >= highestCandidateVotes) {
    return { status: "redraw", counts, tied: false };
  }

  const tiedIds = params.candidateIds.filter(
    (id) => (counts[id] ?? 0) === highestCandidateVotes
  );
  const winnerId = tiedIds[0] ?? params.candidateIds[0];
  if (!winnerId) return { status: "redraw", counts, tied: false };

  return {
    status: "winner",
    winnerId,
    counts,
    tied: tiedIds.length > 1,
  };
}
