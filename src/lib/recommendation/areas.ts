import type { AreaMetadata } from "@/lib/recommendation/types";

export const AREA_CATALOG: AreaMetadata[] = [
  {
    id: "shibuya",
    displayName: "渋谷",
    stationName: "渋谷駅",
    areaKind: "hub",
    prefecture: "Tokyo",
    hubScore: 0.96,
    supplyScore: 0.95,
    nightlifeScore: 0.98,
    discoveryScore: 0.35,
    reliabilityScore: 0.9,
    nearbyHubs: ["恵比寿", "表参道", "下北沢"],
  },
  {
    id: "shinjuku",
    displayName: "新宿",
    stationName: "新宿駅",
    areaKind: "hub",
    prefecture: "Tokyo",
    hubScore: 1,
    supplyScore: 0.99,
    nightlifeScore: 0.95,
    discoveryScore: 0.28,
    reliabilityScore: 0.94,
    nearbyHubs: ["代々木", "高田馬場", "新大久保"],
  },
  {
    id: "ikebukuro",
    displayName: "池袋",
    stationName: "池袋駅",
    areaKind: "hub",
    prefecture: "Tokyo",
    hubScore: 0.92,
    supplyScore: 0.9,
    nightlifeScore: 0.84,
    discoveryScore: 0.42,
    reliabilityScore: 0.88,
    nearbyHubs: ["目白", "大塚", "巣鴨"],
  },
  {
    id: "ginza",
    displayName: "銀座",
    stationName: "銀座駅",
    areaKind: "district",
    prefecture: "Tokyo",
    hubScore: 0.71,
    supplyScore: 0.88,
    nightlifeScore: 0.74,
    discoveryScore: 0.46,
    reliabilityScore: 0.82,
    nearbyHubs: ["東京", "有楽町", "新橋"],
  },
  {
    id: "roppongi",
    displayName: "六本木",
    stationName: "六本木駅",
    areaKind: "district",
    prefecture: "Tokyo",
    hubScore: 0.69,
    supplyScore: 0.83,
    nightlifeScore: 0.9,
    discoveryScore: 0.5,
    reliabilityScore: 0.74,
    nearbyHubs: ["麻布十番", "赤坂", "渋谷"],
  },
  {
    id: "ebisu",
    displayName: "恵比寿",
    stationName: "恵比寿駅",
    areaKind: "district",
    prefecture: "Tokyo",
    hubScore: 0.66,
    supplyScore: 0.81,
    nightlifeScore: 0.73,
    discoveryScore: 0.72,
    reliabilityScore: 0.8,
    nearbyHubs: ["渋谷", "中目黒", "代官山"],
  },
  {
    id: "omotesando",
    displayName: "表参道",
    stationName: "表参道駅",
    areaKind: "district",
    prefecture: "Tokyo",
    hubScore: 0.58,
    supplyScore: 0.7,
    nightlifeScore: 0.48,
    discoveryScore: 0.78,
    reliabilityScore: 0.77,
    nearbyHubs: ["渋谷", "原宿", "青山"],
  },
  {
    id: "shimokitazawa",
    displayName: "下北沢",
    stationName: "下北沢駅",
    areaKind: "discovery",
    prefecture: "Tokyo",
    hubScore: 0.48,
    supplyScore: 0.67,
    nightlifeScore: 0.58,
    discoveryScore: 0.9,
    reliabilityScore: 0.7,
    nearbyHubs: ["渋谷", "新宿"],
  },
  {
    id: "kichijoji",
    displayName: "吉祥寺",
    stationName: "吉祥寺駅",
    areaKind: "discovery",
    prefecture: "Tokyo",
    hubScore: 0.55,
    supplyScore: 0.76,
    nightlifeScore: 0.52,
    discoveryScore: 0.84,
    reliabilityScore: 0.79,
    nearbyHubs: ["新宿", "三鷹"],
  },
  {
    id: "ueno",
    displayName: "上野",
    stationName: "上野駅",
    areaKind: "district",
    prefecture: "Tokyo",
    hubScore: 0.78,
    supplyScore: 0.77,
    nightlifeScore: 0.61,
    discoveryScore: 0.66,
    reliabilityScore: 0.81,
    nearbyHubs: ["秋葉原", "浅草", "東京"],
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, "")
    .replace(/駅$/, "")
    .toLowerCase();
}

export function findAreaMetadataByName(name: string | null | undefined) {
  const normalized = normalize(name);
  return AREA_CATALOG.find(
    (area) =>
      normalize(area.displayName) === normalized ||
      normalize(area.stationName) === normalized
  );
}

export function findAreaMetadataByStation(station: string | null | undefined) {
  const normalized = normalize(station);
  return AREA_CATALOG.find(
    (area) =>
      normalize(area.stationName) === normalized ||
      normalize(area.displayName) === normalized
  );
}
