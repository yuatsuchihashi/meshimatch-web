/**
 * MeshiMatch Place Algorithm v2
 *
 * Station-based recommendation using BFS pathfinding and 5-factor scoring.
 * See: place-algorithm-spec.md
 */

import {
  getStation,
  findStationsByName,
  getAllStations,
  computeGroupAccessCost,
  normalizedPassengerCount,
  normalizedLineCount,
} from "./station-graph";
import { areaReasonTags, buildAreaExplanation } from "./reasons";
import type {
  AreaReasonCode,
  CandidateArea,
  CandidateAreaScores,
  PlaceRecommendationInput,
  Station,
} from "./types";

// --- Constants ---

const MAX_REASONABLE_COST = 60;
const RESTAURANT_SWEET_SPOT = 500;
const DISCOVERY_SIGMA = 1.2;
const MIN_RESTAURANT_COUNT = 50;
const MIN_ACCESS_SCORE = 0.2;

// Estimated restaurant counts per station (MVP: hardcoded for major stations)
// TODO: Replace with HotPepper API batch data
const RESTAURANT_COUNTS: Record<string, number> = {
  "新宿": 5000, "渋谷": 4000, "池袋": 3500, "東京": 2500, "品川": 1500,
  "新橋": 2000, "上野": 1800, "秋葉原": 1200, "銀座": 2500, "六本木": 2000,
  "恵比寿": 1500, "中目黒": 800, "目黒": 600, "三軒茶屋": 600, "下北沢": 500,
  "吉祥寺": 900, "中野": 800, "高田馬場": 700, "飯田橋": 600, "神田": 800,
  "有楽町": 1200, "浜松町": 600, "五反田": 700, "大崎": 400, "蒲田": 600,
  "自由が丘": 400, "二子玉川": 350, "武蔵小杉": 500, "川崎": 1200,
  "横浜": 3000, "赤坂": 800, "表参道": 600, "原宿": 400, "代々木": 300,
  "御茶ノ水": 500, "水道橋": 400, "四ツ谷": 350, "市ヶ谷": 300,
  "錦糸町": 600, "北千住": 800, "押上": 300, "門前仲町": 400,
  "清澄白河": 300, "豊洲": 400, "月島": 250, "日本橋": 700,
  "大手町": 500, "霞ヶ関": 300, "永田町": 200, "溜池山王": 300,
  "麻布十番": 400, "広尾": 250, "白金高輪": 200, "泉岳寺": 150,
  "田町": 400, "三田": 350, "浅草": 900, "日暮里": 300, "巣鴨": 300,
  "赤羽": 500, "大宮": 1200, "立川": 800, "町田": 700, "八王子": 600,
  "荻窪": 400, "三鷹": 350, "国分寺": 300, "府中": 250,
  "練馬": 300, "板橋": 200, "王子": 250, "西日暮里": 200,
  "調布": 350, "明大前": 200, "笹塚": 250, "下高井戸": 200,
  "学芸大学": 300, "祐天寺": 150, "都立大学": 200, "武蔵小山": 250,
  "戸越銀座": 200, "大井町": 400, "西小山": 150, "旗の台": 150,
  "船橋": 600, "柏": 500, "松戸": 400, "千葉": 800,
  "浦和": 400, "南浦和": 200, "川口": 300, "所沢": 350,
  "新横浜": 300, "桜木町": 500, "関内": 400, "上大岡": 250,
  "藤沢": 300, "大船": 250, "戸塚": 200, "鶴見": 200,
  "綱島": 150, "日吉": 200, "菊名": 150, "登戸": 200, "溝の口": 300,
  "代官山": 200, "神泉": 100, "初台": 150, "幡ヶ谷": 150,
  "青山一丁目": 250, "外苑前": 150, "乃木坂": 150,
  "後楽園": 300, "春日": 200, "本郷三丁目": 200,
  "湯島": 200, "根津": 150, "千駄木": 150,
  "神保町": 400, "九段下": 250, "竹橋": 150,
  "新木場": 150, "葛西": 200, "小岩": 300,
  "西船橋": 300, "津田沼": 350, "成増": 200, "和光市": 150,
  "石神井公園": 150, "大泉学園": 100, "田無": 150,
  "国立": 200, "日野": 100,
};

const DEFAULT_RESTAURANT_COUNT = 100;

function getRestaurantCount(station: Station): number {
  return RESTAURANT_COUNTS[station.name] ?? DEFAULT_RESTAURANT_COUNT;
}

// --- Weight Matrix (group size adaptive) ---

interface WeightProfile {
  access: number;
  restaurant: number;
  scale: number;
  discovery: number;
  preference: number;
}

function getWeights(groupSize: number): WeightProfile {
  if (groupSize >= 6) {
    return { access: 0.35, restaurant: 0.35, scale: 0.20, discovery: 0.05, preference: 0.05 };
  }
  if (groupSize >= 4) {
    return { access: 0.35, restaurant: 0.20, scale: 0.15, discovery: 0.20, preference: 0.10 };
  }
  return { access: 0.30, restaurant: 0.10, scale: 0.05, discovery: 0.40, preference: 0.15 };
}

// --- Scoring Functions ---

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function computeAccessScore(avgCost: number): number {
  return clamp(1 - avgCost / MAX_REASONABLE_COST);
}

function computeRestaurantScore(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  return Math.log(count + 1) / Math.log(maxCount + 1);
}

function computeScaleScore(stationId: string): number {
  return 0.6 * normalizedPassengerCount(stationId) + 0.4 * normalizedLineCount(stationId);
}

function computeDiscoveryScore(count: number): number {
  if (count <= 0) return 0;
  const logCount = Math.log(count);
  const logSweet = Math.log(RESTAURANT_SWEET_SPOT);
  return Math.exp(-Math.pow((logCount - logSweet) / DISCOVERY_SIGMA, 2));
}

function computePreferenceScore(
  stationId: string,
  preferredIds: string[],
  adjacentPreferred: Set<string>
): number {
  if (preferredIds.includes(stationId)) return 1.0;
  if (adjacentPreferred.has(stationId)) return 0.5;
  return 0.0;
}

// --- Main Algorithm ---

export function recommendCandidateAreas(
  input: PlaceRecommendationInput,
  limit = 3
): CandidateArea[] {
  const groupSize = input.groupSize ?? input.responses.length;

  // Resolve departure station IDs
  const departureIds: string[] = [];
  const preferredIds: string[] = [];

  for (const response of input.responses) {
    if (response.departureStationId) {
      departureIds.push(response.departureStationId);
    } else if (response.departureStation) {
      // Backward compat: resolve by name
      const matches = findStationsByName(response.departureStation);
      if (matches.length > 0) {
        departureIds.push(matches[0].id);
      }
    }

    for (const prefId of response.preferredStationIds ?? []) {
      preferredIds.push(prefId);
    }
    // Backward compat: resolve preferred areas by name
    for (const areaName of response.preferredAreas ?? []) {
      const matches = findStationsByName(areaName);
      if (matches.length > 0 && !preferredIds.includes(matches[0].id)) {
        preferredIds.push(matches[0].id);
      }
    }
  }

  if (departureIds.length === 0 && preferredIds.length === 0) {
    return [];
  }

  // Build candidate pool
  const candidateSet = new Set<string>();

  // Source 1: Preferred stations
  for (const id of preferredIds) candidateSet.add(id);

  // Source 2: Departure stations
  for (const id of departureIds) candidateSet.add(id);

  // Source 3: Hub stations (top ~100 by passenger count)
  const allStations = getAllStations();
  const hubs = allStations
    .filter((s) => s.passenger_count >= 50000)
    .sort((a, b) => b.passenger_count - a.passenger_count)
    .slice(0, 100);
  for (const hub of hubs) candidateSet.add(hub.id);

  // Source 4: Stations near preferred areas
  // (handled by the adjacentPreferred set below)

  // Find max restaurant count for normalization
  const maxRestaurantCount = Math.max(
    ...allStations.map((s) => getRestaurantCount(s)),
    1
  );

  // Build set of stations adjacent to preferred stations (for preference score 0.5)
  const adjacentPreferred = new Set<string>();
  // (skip for now, would need adjacency lookup)

  // Score all candidates
  const weights = getWeights(groupSize);
  const scored: CandidateArea[] = [];

  for (const candidateId of candidateSet) {
    const station = getStation(candidateId);
    if (!station) continue;

    const restaurantCount = getRestaurantCount(station);

    // Minimum thresholds
    if (restaurantCount < MIN_RESTAURANT_COUNT) continue;

    // Compute access score
    const avgCost = departureIds.length > 0
      ? computeGroupAccessCost(departureIds, candidateId)
      : 0;
    const accessScore = departureIds.length > 0
      ? computeAccessScore(avgCost)
      : 0.5;

    if (accessScore < MIN_ACCESS_SCORE) continue;

    const restaurantScore = computeRestaurantScore(restaurantCount, maxRestaurantCount);
    const scaleScore = computeScaleScore(candidateId);
    const discoveryScore = computeDiscoveryScore(restaurantCount);
    const preferenceScore = computePreferenceScore(candidateId, preferredIds, adjacentPreferred);

    const combined = clamp(
      weights.access * accessScore +
      weights.restaurant * restaurantScore +
      weights.scale * scaleScore +
      weights.discovery * discoveryScore +
      weights.preference * preferenceScore
    );

    // Generate reason codes
    const reasons: AreaReasonCode[] = [];
    if (accessScore >= 0.7) reasons.push("easy_access");
    if (restaurantScore >= 0.7) reasons.push("strong_restaurant");
    if (groupSize >= 5 && scaleScore >= 0.6) reasons.push("good_for_large_group");
    if (discoveryScore >= 0.7) reasons.push("great_discovery");
    if (preferenceScore >= 0.5) reasons.push("matches_preference");

    const scores: CandidateAreaScores = {
      access: accessScore,
      restaurant: restaurantScore,
      scale: scaleScore,
      discovery: discoveryScore,
      preference: preferenceScore,
      combined,
    };

    scored.push({
      areaName: station.name,
      stationName: `${station.name}駅`,
      stationId: station.id,
      lat: station.lat,
      lng: station.lng,
      scores,
      reasons,
      tags: areaReasonTags(reasons),
      explanation: buildAreaExplanation(reasons),
    });
  }

  // Sort by combined score descending, return top N
  scored.sort((a, b) => b.scores.combined - a.scores.combined);

  // Deduplicate by station name (in case multiple station IDs map to same name)
  const seen = new Set<string>();
  const deduped: CandidateArea[] = [];
  for (const candidate of scored) {
    if (!seen.has(candidate.areaName)) {
      seen.add(candidate.areaName);
      deduped.push(candidate);
    }
    if (deduped.length >= limit) break;
  }

  return deduped;
}
