import {
  AREA_CENTERS,
  INITIAL_ZONES,
  haversineKm,
} from "@/lib/areas";
import type { InstantZoneSelection } from "./types";

type Coordinates = { lat: number; lng: number };

export const ZONE_REPRESENTATIVE_COORDS: Record<string, Coordinates> = {
  shibuya: AREA_CENTERS["渋谷"],
  shinjuku: AREA_CENTERS["新宿"],
  ikebukuro: AREA_CENTERS["池袋"],
  tokyo: { lat: 35.6812, lng: 139.7671 },
  shinagawa: { lat: 35.6285, lng: 139.7388 },
  ueno: AREA_CENTERS["上野"],
  ginza: AREA_CENTERS["銀座"],
  roppongi: AREA_CENTERS["六本木"],
  ebisu: AREA_CENTERS["恵比寿"],
  meguro: { lat: 35.6339, lng: 139.7156 },
  akihabara: { lat: 35.6984, lng: 139.773 },
  asakusa: { lat: 35.7148, lng: 139.7967 },
  omotesando: AREA_CENTERS["表参道"],
  shimokitazawa: AREA_CENTERS["下北沢"],
  kichijoji: AREA_CENTERS["吉祥寺"],
  tachikawa: { lat: 35.6984, lng: 139.4137 },
  machida: { lat: 35.542, lng: 139.4457 },
  yokohama: { lat: 35.4658, lng: 139.6223 },
};

export function nearestInstantZoneFromCoordinates(
  coords: Coordinates
): InstantZoneSelection {
  let nearest = INITIAL_ZONES[0];
  let nearestKm = Infinity;

  for (const zone of INITIAL_ZONES) {
    const representative = ZONE_REPRESENTATIVE_COORDS[zone.id];
    if (!representative) continue;
    const distanceKm = haversineKm(coords, representative);
    if (distanceKm < nearestKm) {
      nearest = zone;
      nearestKm = distanceKm;
    }
  }

  return {
    zoneId: nearest.id,
    name: nearest.name,
    station: nearest.station,
    source: "gps",
  };
}
