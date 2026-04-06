import { findAreaMetadataByName, findAreaMetadataByStation } from "@/lib/recommendation/areas";
import { areaReasonTags, buildAreaExplanation } from "@/lib/recommendation/reasons";
import type {
  AreaReasonCode,
  CandidateArea,
  CandidateAreaScores,
  PlaceRecommendationInput,
} from "@/lib/recommendation/types";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getGroupWeight(groupSize: number) {
  if (groupSize >= 8) return 1;
  if (groupSize >= 5) return 0.75;
  if (groupSize >= 3) return 0.5;
  return 0.25;
}

function normalizeAreaName(value: string) {
  return value.replace(/\s+/g, "").replace(/駅$/, "");
}

function collectSignals(input: PlaceRecommendationInput) {
  const preferredCounts = new Map<string, number>();
  const departureCounts = new Map<string, number>();

  for (const response of input.responses) {
    for (const preferredArea of response.preferredAreas ?? []) {
      const area = findAreaMetadataByName(preferredArea);
      if (!area) continue;
      preferredCounts.set(
        area.displayName,
        (preferredCounts.get(area.displayName) ?? 0) + 1
      );
    }

    const departureArea = findAreaMetadataByName(response.departureArea ?? undefined);
    if (departureArea) {
      departureCounts.set(
        departureArea.displayName,
        (departureCounts.get(departureArea.displayName) ?? 0) + 1
      );
      continue;
    }

    const departureStation = findAreaMetadataByStation(
      response.departureStation ?? undefined
    );
    if (!departureStation) continue;
    departureCounts.set(
      departureStation.displayName,
      (departureCounts.get(departureStation.displayName) ?? 0) + 1
    );
  }

  return { preferredCounts, departureCounts };
}

function expandCandidateNames(input: PlaceRecommendationInput) {
  const { preferredCounts, departureCounts } = collectSignals(input);
  const candidateNames = new Set<string>();

  for (const name of preferredCounts.keys()) candidateNames.add(name);
  for (const name of departureCounts.keys()) {
    candidateNames.add(name);
    const area = findAreaMetadataByName(name);
    for (const nearby of area?.nearbyHubs ?? []) {
      candidateNames.add(normalizeAreaName(nearby));
    }
  }

  if (candidateNames.size < 3) {
    const fallbackDiscovery = ["恵比寿", "表参道", "下北沢", "吉祥寺"];
    for (const areaName of fallbackDiscovery) {
      candidateNames.add(areaName);
      if (candidateNames.size >= 5) break;
    }
  }

  return {
    candidateNames: Array.from(candidateNames),
    preferredCounts,
    departureCounts,
  };
}

function scoreArea(
  areaName: string,
  input: PlaceRecommendationInput,
  preferredCounts: Map<string, number>,
  departureCounts: Map<string, number>
): CandidateArea | null {
  const metadata = findAreaMetadataByName(areaName);
  if (!metadata) return null;

  const respondentCount = Math.max(1, input.responses.length);
  const groupSize = Math.max(1, input.groupSize ?? respondentCount);
  const preferredVotes = preferredCounts.get(metadata.displayName) ?? 0;
  const departureVotes = departureCounts.get(metadata.displayName) ?? 0;
  const mentionRatio = clamp((preferredVotes * 1.2 + departureVotes) / respondentCount);
  const groupWeight = getGroupWeight(groupSize);

  let transferSimplicity = average([metadata.hubScore, metadata.reliabilityScore]);
  const midpointCloseness = clamp(mentionRatio + (preferredVotes > 0 ? 0.1 : 0));
  const stationScale = average([metadata.hubScore, metadata.supplyScore]);
  const restaurantSupply = metadata.supplyScore;
  let nightlifeIntensity = metadata.nightlifeScore;
  const discoveryPotential = metadata.discoveryScore;
  const preferredAreaBonus = clamp(preferredVotes / respondentCount);
  const groupSizeAdjustment = clamp(
    average([metadata.supplyScore, metadata.reliabilityScore]) * groupWeight
  );

  if (input.sessionAtmosphere === "calm" || input.sessionAtmosphere === "polished") {
    nightlifeIntensity = clamp(nightlifeIntensity - 0.08);
    transferSimplicity = clamp(transferSimplicity + 0.05);
  }

  if (input.sessionFocus === "drink_centered") {
    nightlifeIntensity = clamp(nightlifeIntensity + 0.08);
  }

  const efficiency = clamp(
    transferSimplicity * 0.24 +
      midpointCloseness * 0.23 +
      stationScale * 0.15 +
      restaurantSupply * 0.2 +
      groupSizeAdjustment * 0.18
  );

  const discovery = clamp(
    discoveryPotential * 0.4 +
      nightlifeIntensity * 0.1 +
      restaurantSupply * 0.18 +
      preferredAreaBonus * 0.14 +
      midpointCloseness * 0.18
  );

  const combined = clamp(
    efficiency * (groupSize >= 5 ? 0.78 : 0.7) +
      discovery * (groupSize >= 5 ? 0.22 : 0.3)
  );

  const reasons: AreaReasonCode[] = [];

  if (transferSimplicity >= 0.78) reasons.push("easy_gather");
  if (midpointCloseness >= 0.65) reasons.push("practical_midpoint");
  if (restaurantSupply >= 0.75) reasons.push("strong_supply");
  if (groupSize >= 5 && groupSizeAdjustment >= 0.5) reasons.push("large_group_safe");
  if (preferredVotes > 0) reasons.push("preferred_area_bonus");
  if (discoveryPotential >= 0.72 && metadata.areaKind !== "hub") {
    reasons.push("discovery_pick");
  }

  const scores: CandidateAreaScores = {
    transferSimplicity,
    midpointCloseness,
    stationScale,
    restaurantSupply,
    nightlifeIntensity,
    discoveryPotential,
    preferredAreaBonus,
    groupSizeAdjustment,
    efficiency,
    discovery,
    combined,
  };

  return {
    areaName: metadata.displayName,
    stationName: metadata.stationName,
    metadata,
    scores,
    reasons,
    tags: areaReasonTags(reasons),
    explanation: buildAreaExplanation(reasons),
  };
}

export function recommendCandidateAreas(
  input: PlaceRecommendationInput,
  limit = 3
) {
  const { candidateNames, preferredCounts, departureCounts } = expandCandidateNames(input);

  return candidateNames
    .map((name) => scoreArea(name, input, preferredCounts, departureCounts))
    .filter((area): area is CandidateArea => area !== null)
    .sort((a, b) => b.scores.combined - a.scores.combined)
    .slice(0, limit);
}
