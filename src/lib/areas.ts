// ============================================================
// エリア・ゾーン定義
// ============================================================

// アンケートでチップ表示するエリア
export const SURVEY_AREAS = [
  "渋谷",
  "新宿",
  "池袋",
  "銀座",
  "六本木",
  "恵比寿",
  "表参道",
  "下北沢",
  "吉祥寺",
  "上野",
] as const;

// エリア中心 (駅座標)。台帳取り込みとお気に入りインポートの最寄りエリア判定に使う
export const AREA_CENTERS: Record<string, { lat: number; lng: number }> = {
  "渋谷": { lat: 35.658, lng: 139.7016 },
  "恵比寿": { lat: 35.6467, lng: 139.7101 },
  "表参道": { lat: 35.6652, lng: 139.7126 },
  "下北沢": { lat: 35.6613, lng: 139.6682 },
  "新宿": { lat: 35.6896, lng: 139.7006 },
  "池袋": { lat: 35.7295, lng: 139.7109 },
  "銀座": { lat: 35.6717, lng: 139.765 },
  "六本木": { lat: 35.6627, lng: 139.7312 },
  "吉祥寺": { lat: 35.7033, lng: 139.5797 },
  "上野": { lat: 35.7138, lng: 139.7774 },
};

export const AREA_RADIUS_KM = 1.2;

export const ZONE_GENERATION = 1;

export interface ZoneDefinition {
  id: string;
  name: string;
  generation: number;
  station: string;
}

export const INITIAL_ZONES: ZoneDefinition[] = [
  { id: "shibuya", name: "渋谷", station: "渋谷駅", generation: ZONE_GENERATION },
  { id: "shinjuku", name: "新宿", station: "新宿駅", generation: ZONE_GENERATION },
  { id: "ikebukuro", name: "池袋", station: "池袋駅", generation: ZONE_GENERATION },
  { id: "tokyo", name: "東京", station: "東京駅", generation: ZONE_GENERATION },
  { id: "shinagawa", name: "品川", station: "品川駅", generation: ZONE_GENERATION },
  { id: "ueno", name: "上野", station: "上野駅", generation: ZONE_GENERATION },
  { id: "ginza", name: "銀座", station: "銀座駅", generation: ZONE_GENERATION },
  { id: "roppongi", name: "六本木", station: "六本木駅", generation: ZONE_GENERATION },
  { id: "ebisu", name: "恵比寿", station: "恵比寿駅", generation: ZONE_GENERATION },
  { id: "meguro", name: "目黒", station: "目黒駅", generation: ZONE_GENERATION },
  { id: "akihabara", name: "秋葉原", station: "秋葉原駅", generation: ZONE_GENERATION },
  { id: "asakusa", name: "浅草", station: "浅草駅", generation: ZONE_GENERATION },
  { id: "omotesando", name: "表参道", station: "表参道駅", generation: ZONE_GENERATION },
  { id: "shimokitazawa", name: "下北沢", station: "下北沢駅", generation: ZONE_GENERATION },
  { id: "kichijoji", name: "吉祥寺", station: "吉祥寺駅", generation: ZONE_GENERATION },
  { id: "tachikawa", name: "立川", station: "立川駅", generation: ZONE_GENERATION },
  { id: "machida", name: "町田", station: "町田駅", generation: ZONE_GENERATION },
  { id: "yokohama", name: "横浜", station: "横浜駅", generation: ZONE_GENERATION },
];

export const INITIAL_STATION_ZONE_MAP = INITIAL_ZONES.map((zone) => ({
  station: zone.station,
  zoneId: zone.id,
  generation: zone.generation,
}));

export function normalizeStationName(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/\s+/g, "").trim();
  if (!normalized) return "";
  return normalized.endsWith("駅") ? normalized : `${normalized}駅`;
}

export function resolveZoneForStation(
  station: string | null | undefined,
  generation = ZONE_GENERATION
) {
  const normalized = normalizeStationName(station);
  const mapping = INITIAL_STATION_ZONE_MAP.find(
    (entry) => entry.generation === generation && entry.station === normalized
  );
  if (!mapping) return null;
  return (
    INITIAL_ZONES.find(
      (zone) => zone.generation === generation && zone.id === mapping.zoneId
    ) ?? null
  );
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestSurveyArea(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [area, center] of Object.entries(AREA_CENTERS)) {
    const d = haversineKm({ lat, lng }, center);
    if (d < bestDist) {
      bestDist = d;
      best = area;
    }
  }
  return bestDist <= AREA_RADIUS_KM ? best : null;
}
