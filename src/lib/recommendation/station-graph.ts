/**
 * Station Graph Module for MeshiMatch Place Algorithm v2
 *
 * Provides BFS pathfinding over Tokyo metro area station adjacency graph.
 * Data is loaded lazily from static JSON files (~1200 stations, ~1250 edges).
 */

import type { Station, StationEdge, Line } from "./types";
import stationsData from "@/data/stations.json";
import adjacencyData from "@/data/adjacency.json";
import linesData from "@/data/lines.json";

// --- Data ---

const stations: Station[] = stationsData as Station[];
const edges: StationEdge[] = adjacencyData as StationEdge[];
const lines: Line[] = linesData as Line[];

// --- Indexes (built once on first access) ---

let stationById: Map<string, Station> | null = null;
let stationsByName: Map<string, Station[]> | null = null;
let adjacencyMap: Map<string, { neighbor: string; lineId: string }[]> | null = null;
let maxPassengerCount: number | null = null;
let maxLineCount: number | null = null;

function ensureIndexes() {
  if (stationById) return;

  stationById = new Map();
  stationsByName = new Map();
  adjacencyMap = new Map();
  maxPassengerCount = 0;
  maxLineCount = 0;

  for (const s of stations) {
    stationById.set(s.id, s);
    const existing = stationsByName.get(s.name) ?? [];
    existing.push(s);
    stationsByName.set(s.name, existing);
    if (s.passenger_count > maxPassengerCount) maxPassengerCount = s.passenger_count;
    if (s.line_ids.length > maxLineCount) maxLineCount = s.line_ids.length;
  }

  for (const edge of edges) {
    const aList = adjacencyMap.get(edge.station_a) ?? [];
    aList.push({ neighbor: edge.station_b, lineId: edge.line_id });
    adjacencyMap.set(edge.station_a, aList);

    const bList = adjacencyMap.get(edge.station_b) ?? [];
    bList.push({ neighbor: edge.station_a, lineId: edge.line_id });
    adjacencyMap.set(edge.station_b, bList);
  }
}

// --- Public API ---

export function getStation(id: string): Station | undefined {
  ensureIndexes();
  return stationById!.get(id);
}

export function findStationsByName(query: string): Station[] {
  ensureIndexes();
  const normalized = query.replace(/\s+/g, "").replace(/駅$/, "");
  if (!normalized) return [];
  return stationsByName!.get(normalized) ?? [];
}

export function searchStations(query: string, limit = 10): Station[] {
  ensureIndexes();
  const normalized = query.replace(/\s+/g, "").replace(/駅$/, "");
  if (!normalized) return [];

  const results: Station[] = [];
  for (const [name, stationList] of stationsByName!.entries()) {
    if (name.includes(normalized)) {
      results.push(stationList[0]);
      if (results.length >= limit) break;
    }
  }

  // Sort exact matches first, then by passenger count
  return results.sort((a, b) => {
    const aExact = a.name === normalized ? 1 : 0;
    const bExact = b.name === normalized ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return b.passenger_count - a.passenger_count;
  });
}

export function getAllStations(): Station[] {
  return stations;
}

export function getAllLines(): Line[] {
  return lines;
}

/**
 * BFS pathfinding between two stations.
 * Returns travel cost = stops * 1.0 + transfers * 5.0
 * Returns Infinity if no path exists.
 */
export function travelCost(fromId: string, toId: string): number {
  ensureIndexes();
  if (fromId === toId) return 0;
  if (!adjacencyMap!.has(fromId) || !adjacencyMap!.has(toId)) return Infinity;

  // BFS tracking: station -> { stops, transfers, lastLineId }
  const visited = new Map<string, { stops: number; transfers: number; lastLineId: string }>();
  const queue: { stationId: string; stops: number; transfers: number; lastLineId: string }[] = [];

  // Initialize with all neighbors of fromId
  for (const { neighbor, lineId } of adjacencyMap!.get(fromId) ?? []) {
    const key = `${neighbor}:${lineId}`;
    if (!visited.has(key)) {
      visited.set(key, { stops: 1, transfers: 0, lastLineId: lineId });
      queue.push({ stationId: neighbor, stops: 1, transfers: 0, lastLineId: lineId });
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];

    if (current.stationId === toId) {
      return current.stops * 1.0 + current.transfers * 5.0;
    }

    for (const { neighbor, lineId } of adjacencyMap!.get(current.stationId) ?? []) {
      const isTransfer = lineId !== current.lastLineId ? 1 : 0;
      const newStops = current.stops + 1;
      const newTransfers = current.transfers + isTransfer;
      const newCost = newStops * 1.0 + newTransfers * 5.0;
      const key = `${neighbor}:${lineId}`;
      const existing = visited.get(key);

      if (!existing || (existing.stops * 1.0 + existing.transfers * 5.0) > newCost) {
        visited.set(key, { stops: newStops, transfers: newTransfers, lastLineId: lineId });
        queue.push({ stationId: neighbor, stops: newStops, transfers: newTransfers, lastLineId: lineId });
      }
    }
  }

  return Infinity;
}

/**
 * Compute average access cost from multiple departure stations to a candidate.
 */
export function computeGroupAccessCost(departureIds: string[], candidateId: string): number {
  if (departureIds.length === 0) return Infinity;
  let total = 0;
  for (const depId of departureIds) {
    total += travelCost(depId, candidateId);
  }
  return total / departureIds.length;
}

/**
 * Get normalized passenger count (0-1 scale)
 */
export function normalizedPassengerCount(stationId: string): number {
  ensureIndexes();
  const station = stationById!.get(stationId);
  if (!station || !maxPassengerCount) return 0;
  return station.passenger_count / maxPassengerCount;
}

/**
 * Get normalized line count (0-1 scale)
 */
export function normalizedLineCount(stationId: string): number {
  ensureIndexes();
  const station = stationById!.get(stationId);
  if (!station || !maxLineCount) return 0;
  return station.line_ids.length / maxLineCount;
}
