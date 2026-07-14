// ============================================================
// Overture Places GeoJSON → 台帳 (restaurants) 取り込み
// ============================================================
// 使い方:
//   node scripts/ingest-overture.mjs <path/to/places.geojson>
//
// - 飲食カテゴリのみをホワイトリストで採用 (bar 部分一致などの誤爆を防ぐ)
// - confidence >= 0.6 のみ
// - 最寄りエリア (SURVEY_AREAS の駅座標から 1.2km 以内) を付与、圏外は捨てる
// - external_id "overture:<id>" で冪等 (再実行しても重複しない)
// - 出力先: .localdb/db.json の restaurants テーブル
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CATEGORY_TO_GENRE } from "./genre-space.mjs";

const geojsonPath = process.argv[2];
if (!geojsonPath) {
  console.error("usage: node scripts/ingest-overture.mjs <places.geojson>");
  process.exit(1);
}

// エリア中心 (駅座標)。bbox を広げたらここに追加する
const AREA_CENTERS = {
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
const AREA_RADIUS_KM = 1.2;

const MIN_CONFIDENCE = 0.6;

function haversineKm(a, b) {
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

function nearestArea(lat, lng) {
  let best = null;
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

const dbPath = path.join(process.cwd(), ".localdb", "db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
db.restaurants ??= [];
const existingByExternal = new Map(
  db.restaurants.map((r) => [r.external_id, r])
);

const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));
const now = new Date().toISOString();

let added = 0;
let updated = 0;
let skippedCategory = 0;
let skippedConfidence = 0;
let skippedArea = 0;

for (const feature of geojson.features) {
  const p = feature.properties;
  const primary = p.categories?.primary;
  const genreId = CATEGORY_TO_GENRE[primary];
  if (!genreId) {
    skippedCategory += 1;
    continue;
  }
  if ((p.confidence ?? 0) < MIN_CONFIDENCE) {
    skippedConfidence += 1;
    continue;
  }
  const [lng, lat] = feature.geometry.coordinates;
  const area = nearestArea(lat, lng);
  if (!area) {
    skippedArea += 1;
    continue;
  }

  const externalId = `overture:${feature.id ?? p.id}`;
  const row = {
    name: p.names.primary,
    name_en:
      p.names?.common?.en ??
      (p.names?.rules ?? []).find((r) => r.language === "en")?.value ??
      null,
    lat,
    lng,
    nearest_area: area,
    genre_id: genreId,
    price_band: null,
    address: (p.addresses ?? [])[0]?.freeform ?? null,
    url: p.websites?.[0] ?? null,
    photo_url: null,
    closed: false,
    external_id: externalId,
    updated_at: now,
  };

  const existing = existingByExternal.get(externalId);
  if (existing) {
    Object.assign(existing, row);
    updated += 1;
  } else {
    db.restaurants.push({ id: crypto.randomUUID(), created_at: now, ...row });
    added += 1;
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log(
  `done. added=${added} updated=${updated} skipped: category=${skippedCategory} confidence=${skippedConfidence} outOfArea=${skippedArea}`
);
console.log(`total restaurants in gazetteer: ${db.restaurants.length}`);

const byArea = {};
for (const r of db.restaurants) byArea[r.nearest_area] = (byArea[r.nearest_area] ?? 0) + 1;
console.log("by area:", byArea);
